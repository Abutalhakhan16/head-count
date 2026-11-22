import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '10mb' }));

const TEST_FILES_DIR = path.join(__dirname, 'frontend', 'public', 'test_files');

const DEMO_STREAMS = {
  'demo://classroom_lecture': 'classroom_lecture.mp4',
  'demo://real_people': 'real_people_test.mp4',
  'demo://crowd_group': 'crowd_group_test.mp4',
  'demo://student_webcam': 'student_webcam_test.mp4',
};

// In-memory camera store
const CAMERAS = {
  cam_webcam: {
    id: 'cam_webcam',
    name: 'Live Camera (Webcam / USB)',
    rtsp_url: 'webcam://device-0',
    classroom: 'Current Room / Local Station',
    fps: 30,
    status: 'ONLINE',
    roi: { x: 5, y: 5, width: 90, height: 90 },
  },
  cam_101: {
    id: 'cam_101',
    name: 'LH-101 Front Overhead HD',
    rtsp_url: 'rtsp://admin:stream@192.168.1.101:554/live/main',
    classroom: 'Alan Turing Lecture Hall',
    fps: 30,
    status: 'ONLINE',
    roi: { x: 5, y: 15, width: 90, height: 80 },
  },
  cam_204: {
    id: 'cam_204',
    name: 'LAB-204 Wide Angle 4K',
    rtsp_url: 'rtsp://admin:stream@192.168.1.102:554/live/main',
    classroom: 'AI & Robotics Laboratory',
    fps: 25,
    status: 'ONLINE',
    roi: { x: 8, y: 12, width: 84, height: 82 },
  },
};

function isAllowedStreamUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (Object.prototype.hasOwnProperty.call(DEMO_STREAMS, trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return ['rtsp:', 'rtsps:', 'http:', 'https:', 'rtp:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function probeStream(url) {
  const trimmed = url.trim();
  if (Object.prototype.hasOwnProperty.call(DEMO_STREAMS, trimmed)) {
    const filePath = path.join(TEST_FILES_DIR, DEMO_STREAMS[trimmed]);
    if (!fs.existsSync(filePath)) {
      return { online: false, message: 'Demo stream file not found.' };
    }
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', filePath],
      { timeout: 4000 }
    );
    const parsed = JSON.parse(stdout || '{}');
    const stream = parsed.streams?.[0];
    const resolution = stream ? `${stream.width}x${stream.height}` : '1280x720';
    return {
      online: true,
      reachable: true,
      resolution,
      codec: stream?.codec_name || 'h264',
      message: `Connected to CCTV Demo Stream (${resolution})`,
    };
  }

  if (!isAllowedStreamUrl(trimmed)) {
    return {
      online: false,
      reachable: false,
      message: 'Invalid stream URL. Use rtsp://, rtsps://, http://, https://, or demo:// presets.',
    };
  }

  const args = ['-v', 'error'];
  if (trimmed.startsWith('rtsp://') || trimmed.startsWith('rtsps://')) {
    args.push('-rtsp_transport', 'tcp');
  }
  args.push(
    '-rw_timeout', '3500000',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name',
    '-of', 'json',
    trimmed
  );

  try {
    const { stdout } = await execFileAsync('ffprobe', args, { timeout: 5000 });
    const parsed = JSON.parse(stdout || '{}');
    const stream = parsed.streams?.[0];
    if (stream && stream.width && stream.height) {
      return {
        online: true,
        reachable: true,
        resolution: `${stream.width}x${stream.height}`,
        codec: stream.codec_name || 'video',
        message: `Verified live stream (${stream.width}x${stream.height} • ${stream.codec_name || 'video'})`,
      };
    }
  } catch {
    // Fallback HTTP header probe for MJPEG/HTTP cameras
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch(trimmed, { method: 'GET', signal: controller.signal });
        clearTimeout(timer);
        const ct = resp.headers.get('content-type') || '';
        controller.abort();
        if (resp.ok && (ct.includes('multipart') || ct.includes('image') || ct.includes('video') || ct.includes('mpegurl'))) {
          return {
            online: true,
            reachable: true,
            resolution: 'Live HTTP Stream',
            codec: ct.split(';')[0],
            message: `Verified HTTP camera stream (${ct.split(';')[0]})`,
          };
        }
      } catch {
        // Fall through to unreachable message
      }
    }
  }

  return {
    online: false,
    reachable: false,
    message: `Could not reach stream at ${trimmed}. Private LAN IPs (192.168.x.x) require port forwarding or a tunnel; you can still Save & Stream with demo fallback or select a Demo CCTV preset.`,
  };
}

function streamWithFfmpeg(req, res, inputPathOrUrl, isLoopFile = false) {
  const args = ['-v', 'error'];
  if (isLoopFile) {
    args.push('-stream_loop', '-1', '-re');
  } else if (inputPathOrUrl.startsWith('rtsp://') || inputPathOrUrl.startsWith('rtsps://')) {
    args.push('-rtsp_transport', 'tcp', '-rw_timeout', '5000000');
  } else if (inputPathOrUrl.startsWith('http://') || inputPathOrUrl.startsWith('https://')) {
    args.push('-rw_timeout', '5000000');
  }

  args.push(
    '-i', inputPathOrUrl,
    '-an',
    '-vf', "scale='min(1280,iw)':-2",
    '-r', '12',
    '-q:v', '5',
    '-f', 'mpjpeg',
    '-boundary_tag', 'ffmpeg',
    'pipe:1'
  );

  const ff = spawn('ffmpeg', args);
  let headersSent = false;

  const ensureHeaders = () => {
    if (!headersSent) {
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=ffmpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Connection: 'close',
      });
    }
  };

  ff.stdout.on('data', (chunk) => {
    ensureHeaders();
    if (!res.writableEnded) {
      res.write(chunk);
    }
  });

  ff.stderr.on('data', () => {
    // Suppress verbose ffmpeg stderr
  });

  ff.on('error', () => {
    if (!headersSent) {
      res.status(503).json({ error: 'Failed to launch stream transcoder' });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  ff.on('close', (code) => {
    if (!headersSent && code !== 0) {
      res.status(503).json({ error: 'Stream unavailable or timed out' });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  req.on('close', () => {
    if (!ff.killed) {
      ff.kill('SIGKILL');
    }
  });
}

app.get('/api/status', (_req, res) => {
  res.json({
    online: true,
    version: '2.6.0',
    model: 'TensorFlow.js COCO-SSD + BlazeFace + FFmpeg RTSP Engine',
    tracker: 'ByteTrack / Kalman Centroid Tracker',
    device: 'Browser WebGL/CPU + Node.js FFmpeg Media Proxy',
    active_streams: Object.keys(CAMERAS).length,
    fps: 30,
    features: {
      head_counting: true,
      webcam_support: true,
      cctv_rtsp_support: true,
      roi_filter: true,
    },
    privacy: 'GDPR / FERPA Compliant - Zero Biometric Identity Stored',
  });
});

app.get('/api/cameras', (_req, res) => {
  res.json(Object.values(CAMERAS));
});

app.post('/api/cameras', (req, res) => {
  const { id, name, rtsp_url, classroom, fps, roi } = req.body || {};
  const camId = id || `cam_${Date.now()}`;
  CAMERAS[camId] = {
    id: camId,
    name: name || 'Connected Camera',
    rtsp_url: rtsp_url || '',
    classroom: classroom || 'Classroom',
    fps: fps || 30,
    status: 'ONLINE',
    roi: roi || { x: 5, y: 5, width: 90, height: 90 },
  };
  res.json(CAMERAS[camId]);
});

app.post('/api/test-cctv', async (req, res) => {
  const url = String(req.body?.rtsp_url || '').trim();
  if (!url) {
    return res.json({ online: false, reachable: false, message: 'RTSP / Stream URL is empty' });
  }
  const result = await probeStream(url);
  return res.json(result);
});

app.get('/api/cctv/stream', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!isAllowedStreamUrl(rawUrl)) {
    return res.status(400).json({ error: 'Invalid or unsupported stream URL' });
  }

  if (Object.prototype.hasOwnProperty.call(DEMO_STREAMS, rawUrl)) {
    const filePath = path.join(TEST_FILES_DIR, DEMO_STREAMS[rawUrl]);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Demo stream file not found' });
    }
    return streamWithFfmpeg(req, res, filePath, true);
  }

  const probe = await probeStream(rawUrl);
  if (!probe.online) {
    return res.status(503).json({ error: probe.message || 'Stream unreachable' });
  }

  return streamWithFfmpeg(req, res, rawUrl, false);
});

app.get('/api/stream/:cameraId', async (req, res) => {
  const cam = CAMERAS[req.params.cameraId];
  if (!cam || !cam.rtsp_url) {
    return res.status(404).json({ error: 'Camera not found' });
  }
  if (Object.prototype.hasOwnProperty.call(DEMO_STREAMS, cam.rtsp_url)) {
    const filePath = path.join(TEST_FILES_DIR, DEMO_STREAMS[cam.rtsp_url]);
    return streamWithFfmpeg(req, res, filePath, true);
  }
  const probe = await probeStream(cam.rtsp_url);
  if (!probe.online) {
    return res.status(503).json({ error: probe.message || 'Camera stream unreachable' });
  }
  return streamWithFfmpeg(req, res, cam.rtsp_url, false);
});

// Serve static Vite build from frontend/dist AFTER API routes
const distDir = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distDir));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Smart Classroom Analytics server running at http://${HOST}:${PORT}`);
});
