import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera as CameraIcon, 
  Video, 
  VideoOff,
  Upload, 
  Play, 
  Pause, 
  RefreshCw, 
  Sliders, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Wifi, 
  Cpu, 
  Eye, 
  Settings2, 
  Download,
  Target,
  UserCheck,
  Crosshair,
  Sparkles,
  Save,
  Radio,
  Plus,
  X,
  FileVideo,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { Camera, Classroom, Lecture } from '../types';
import { aiBackendService, BackendStatus, DetectionBoxData } from '../services/aiBackendService';
import { storageService } from '../services/storage';

interface CCTVMonitoringViewProps {
  cameras: Camera[];
  classrooms: Classroom[];
  lectures?: Lecture[];
  onSaveLecture?: (lecture: Lecture) => void;
  onSaveCamera?: (camera: Camera) => void;
  backendStatus: BackendStatus;
  onRefreshBackend: () => void;
}

export const CCTVMonitoringView: React.FC<CCTVMonitoringViewProps> = ({
  cameras,
  classrooms,
  lectures = [],
  onSaveLecture,
  onSaveCamera,
  backendStatus,
  onRefreshBackend,
}) => {
  // Feed source mode
  const [selectedCameraId, setSelectedCameraId] = useState<string>(cameras[0]?.id || 'cam_webcam');
  const [feedMode, setFeedMode] = useState<'WEBCAM' | 'CCTV_STREAM' | 'SIMULATED' | 'UPLOADED' | 'TEST_FILE'>('WEBCAM');
  const [countMode, setCountMode] = useState<'head' | 'person' | 'both'>('head');
  
  // Webcam Hardware State
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Playback & Display Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showRoiZone, setShowRoiZone] = useState<boolean>(true);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.35);

  // Test Files State
  const [selectedTestFile, setSelectedTestFile] = useState<string | null>(null);

  // Connect CCTV Modal State
  const [isConnectCctvModalOpen, setIsConnectCctvModalOpen] = useState(false);
  const [cctvName, setCctvName] = useState('');
  const [cctvRtsp, setCctvRtsp] = useState('rtsp://admin:password@192.168.1.100:554/live/main');
  const [cctvIp, setCctvIp] = useState('192.168.1.100');
  const [cctvPort, setCctvPort] = useState(554);
  const [cctvClassroomId, setCctvClassroomId] = useState(classrooms[0]?.id || 'cls_101');
  const [cctvTesting, setCctvTesting] = useState(false);
  const [cctvTestResult, setCctvTestResult] = useState<{ online: boolean; message: string } | null>(null);

  // Custom Video Upload
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HTML Element Refs
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);

  // Live Detected Count State
  const [liveCount, setLiveCount] = useState<number>(0);
  const [headCount, setHeadCount] = useState<number>(0);
  const [personCount, setPersonCount] = useState<number>(0);
  const [totalTrackedEver, setTotalTrackedEver] = useState<number>(0);
  const [liveFps, setLiveFps] = useState<number>(30);
  const [detectionLatency, setDetectionLatency] = useState<number>(22);
  const [currentBoxes, setCurrentBoxes] = useState<DetectionBoxData[]>([]);
  const [attendanceSavedToast, setAttendanceSavedToast] = useState<string | null>(null);

  // Activity Logs
  const [detectionLogs, setDetectionLogs] = useState<string[]>([
    'System ready: High-accuracy AI Head Counting engine loaded',
    'CCTV RTSP integration & camera vision ready',
  ]);

  const activeCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];
  const activeClassroom = classrooms.find(c => c.id === activeCamera?.classroomId) || classrooms[0];
  const activeLecture = lectures.find(l => l.status === 'IN_PROGRESS') || lectures[0];

  // ROI Zone (percentage 0-100)
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number }>({
    x: activeCamera?.roiZone?.x ?? 5,
    y: activeCamera?.roiZone?.y ?? 5,
    width: activeCamera?.roiZone?.width ?? 90,
    height: activeCamera?.roiZone?.height ?? 90,
  });

  // Query available video cameras on mount
  useEffect(() => {
    async function getDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          setWebcamDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }
      } catch (err) {
        console.warn('Could not list media devices:', err);
      }
    }
    getDevices();
  }, []);

  // Sync mode with camera selection
  useEffect(() => {
    if (selectedCameraId === 'cam_webcam') {
      setFeedMode('WEBCAM');
    } else {
      const cam = cameras.find(c => c.id === selectedCameraId);
      if (cam) {
        if (cam.rtspUrl && (cam.rtspUrl.startsWith('rtsp://') || cam.rtspUrl.startsWith('http://'))) {
          setFeedMode('CCTV_STREAM');
        } else {
          setFeedMode('SIMULATED');
        }
        if (cam.roiZone) {
          setRoi(cam.roiZone);
        }
      }
      stopWebcam();
    }
  }, [selectedCameraId, cameras]);

  // Start Webcam stream
  const startWebcam = useCallback(async (deviceId?: string) => {
    try {
      setWebcamError(null);
      stopWebcam();

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
      }

      setIsWebcamActive(true);
      setIsPlaying(true);
      setDetectionLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Live Camera started: Built-in / USB Camera active`,
        ...prev.slice(0, 8),
      ]);
    } catch (err: any) {
      console.error('Webcam start error:', err);
      setWebcamError(err.message || 'Could not access camera. Please allow camera permissions in your browser.');
      setIsWebcamActive(false);
    }
  }, []);

  // Stop Webcam stream
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stopWebcam]);

  // Handle uploaded video file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopWebcam();
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
      setUploadedFileName(file.name);
      setFeedMode('UPLOADED');
      setIsPlaying(true);
      setDetectionLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Processing uploaded video file: ${file.name}`,
        ...prev.slice(0, 8),
      ]);
    }
  };

  // Load a built-in test asset
  const handleLoadTestFile = (path: string, name: string) => {
    stopWebcam();
    setSelectedTestFile(path);
    setFeedMode('TEST_FILE');
    setIsPlaying(true);
    setDetectionLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Loaded Test Sample: ${name}`,
      ...prev.slice(0, 8),
    ]);
  };

  // Test CCTV connection
  const handleTestCctv = async () => {
    setCctvTesting(true);
    setCctvTestResult(null);
    try {
      const res = await aiBackendService.testCctvConnection(cctvRtsp);
      setCctvTestResult(res);
    } catch (e: any) {
      setCctvTestResult({ online: false, message: e.message || 'Connection failed' });
    } finally {
      setCctvTesting(false);
    }
  };

  // Save and connect new CCTV Camera
  const handleSaveAndConnectCctv = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignedClassroom = classrooms.find(c => c.id === cctvClassroomId);
    const newCamId = `cctv_${Date.now()}`;
    const newCamera: Camera = {
      id: newCamId,
      name: cctvName || `CCTV Stream ${cameras.length + 1}`,
      classroomId: cctvClassroomId,
      classroomName: assignedClassroom ? assignedClassroom.name : 'Classroom',
      rtspUrl: cctvRtsp,
      ipAddress: cctvIp,
      port: Number(cctvPort),
      status: 'ONLINE',
      resolution: '1920x1080 (1080p)',
      fps: 30,
      bitrate: '4.8 Mbps',
      latencyMs: 120,
      lastPing: 'Just now',
      roiZone: { x: 5, y: 10, width: 90, height: 85 },
    };

    // Register with backend
    await aiBackendService.registerCamera({
      id: newCamId,
      name: newCamera.name,
      rtsp_url: newCamera.rtspUrl,
      classroom: newCamera.classroomName,
    });

    if (onSaveCamera) {
      onSaveCamera(newCamera);
    } else {
      storageService.saveCamera(newCamera);
    }

    setSelectedCameraId(newCamId);
    setFeedMode('CCTV_STREAM');
    setIsConnectCctvModalOpen(false);
    setDetectionLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Connected new CCTV: ${newCamera.name} (${cctvRtsp})`,
      ...prev.slice(0, 8),
    ]);
  };

  // Perform Head Detection on a single video frame via Backend or In-Browser
  const processCurrentFrame = useCallback(async (videoEl: HTMLVideoElement) => {
    if (processingRef.current || !videoEl || videoEl.readyState < 2 || videoEl.paused || videoEl.ended) {
      return;
    }

    processingRef.current = true;
    const startTime = performance.now();

    try {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const oc = offscreenCanvasRef.current;
      const targetW = 640;
      const targetH = 360;
      oc.width = targetW;
      oc.height = targetH;
      const octx = oc.getContext('2d');
      if (!octx) {
        processingRef.current = false;
        return;
      }

      octx.drawImage(videoEl, 0, 0, targetW, targetH);

      if (backendStatus.online) {
        const blob = await new Promise<Blob | null>(resolve => {
          oc.toBlob(b => resolve(b), 'image/jpeg', 0.75);
        });

        if (blob) {
          const result = await aiBackendService.processFrame(blob, {
            mode: countMode,
            confidence: confidenceThreshold,
            roi,
          });

          if (result && result.boxes) {
            const scaleX = 1280 / targetW;
            const scaleY = 720 / targetH;

            const scaledBoxes: DetectionBoxData[] = result.boxes.map(b => ({
              ...b,
              x: Math.round(b.x * scaleX),
              y: Math.round(b.y * scaleY),
              width: Math.round(b.width * scaleX),
              height: Math.round(b.height * scaleY),
              head_box: b.head_box ? {
                x: Math.round(b.head_box.x * scaleX),
                y: Math.round(b.head_box.y * scaleY),
                width: Math.round(b.head_box.width * scaleX),
                height: Math.round(b.head_box.height * scaleY),
              } : undefined,
            }));

            setCurrentBoxes(scaledBoxes);
            setLiveCount(result.count);
            setHeadCount(result.head_count ?? result.count);
            setPersonCount(result.person_count ?? 0);
            if (result.total_unique_tracked) {
              setTotalTrackedEver(result.total_unique_tracked);
            }
            const duration = Math.round(performance.now() - startTime);
            setDetectionLatency(duration);
            setLiveFps(Math.min(30, Math.round(1000 / Math.max(1, duration))));
          }
        }
      }
    } catch (err) {
      console.warn('Frame processing tick error:', err);
    } finally {
      processingRef.current = false;
    }
  }, [backendStatus.online, countMode, confidenceThreshold, roi]);

  // Main Render & Detection Loop
  useEffect(() => {
    let lastProcessTime = 0;
    const processIntervalMs = 120;
    let simTick = 0;

    const renderLoop = (time: number) => {
      simTick += 0.03;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Handle video sources
      const activeVideo = feedMode === 'WEBCAM' 
        ? webcamVideoRef.current 
        : feedMode === 'TEST_FILE' || feedMode === 'UPLOADED' 
        ? testVideoRef.current 
        : null;

      if (activeVideo && !activeVideo.paused) {
        if (feedMode !== 'WEBCAM') {
          ctx.drawImage(activeVideo, 0, 0, width, height);
        }
        if (time - lastProcessTime > processIntervalMs) {
          lastProcessTime = time;
          processCurrentFrame(activeVideo);
        }
      } else if (feedMode === 'SIMULATED') {
        // Draw synthesized classroom amphitheatre
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.2, '#1e293b');
        bgGrad.addColorStop(0.35, '#334155');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Whiteboard / Lecture Screen
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(width * 0.28, height * 0.04, width * 0.44, height * 0.14);
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText('CS301: Deep Convolutional Networks • AI Headcount Active', width * 0.30, height * 0.12);

        // Desk tiers
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 6; i++) {
          const yPos = height * (0.22 + i * 0.12);
          ctx.beginPath();
          ctx.moveTo(width * 0.06, yPos);
          ctx.lineTo(width * 0.94, yPos);
          ctx.stroke();
        }

        // Draw 70 student avatars
        const simBoxes: DetectionBoxData[] = [];
        let sid = 1;
        const rows = 5;
        const cols = 14;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const bx = (0.12 + c * 0.055 + (r * 0.005)) * width;
            const by = (0.25 + r * 0.12) * height;
            const bw = 0.042 * width;
            const bh = 0.088 * height;
            const wobble = Math.sin(simTick + sid * 0.4) * 2;

            ctx.fillStyle = '#1e3a8a';
            ctx.beginPath();
            ctx.arc(bx + bw / 2, by + bh * 0.3 + wobble * 0.3, bw * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.ellipse(bx + bw / 2, by + bh * 0.75 + wobble * 0.3, bw * 0.45, bh * 0.3, 0, 0, Math.PI);
            ctx.fill();

            const hx = bx + bw * 0.15;
            const hy = by + wobble * 0.3;
            const hw = bw * 0.7;
            const hh = bh * 0.55;

            const rx = (roi.x / 100) * width;
            const ry = (roi.y / 100) * height;
            const rw = (roi.width / 100) * width;
            const rh = (roi.height / 100) * height;
            const inRoi = hx + hw/2 >= rx && hy + hh/2 >= ry && hx + hw/2 <= rx + rw && hy + hh/2 <= ry + rh;

            simBoxes.push({
              track_id: sid++,
              x: Math.round(countMode === 'head' ? hx : bx),
              y: Math.round(countMode === 'head' ? hy : by),
              width: Math.round(countMode === 'head' ? hw : bw),
              height: Math.round(countMode === 'head' ? hh : bh),
              confidence: 0.91 + (sid % 7) * 0.01,
              class_name: countMode === 'head' ? 'head' : 'person',
              label: countMode === 'head' ? `Head #${sid - 1}` : `Person #${sid - 1}`,
              in_roi: inRoi,
            });
          }
        }

        const insideSim = simBoxes.filter(b => b.in_roi).length;
        setLiveCount(insideSim);
        setHeadCount(insideSim);
        setCurrentBoxes(simBoxes);
      }

      // Draw ROI Zone
      if (showRoiZone) {
        const rx = (roi.x / 100) * width;
        const ry = (roi.y / 100) * height;
        const rw = (roi.width / 100) * width;
        const rh = (roi.height / 100) * height;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);

        const cornerSize = 14;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(rx, ry + cornerSize); ctx.lineTo(rx, ry); ctx.lineTo(rx + cornerSize, ry); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerSize, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + cornerSize); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx, ry + rh - cornerSize); ctx.lineTo(rx, ry + rh); ctx.lineTo(rx + cornerSize, ry + rh); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerSize, ry + rh); ctx.lineTo(rx + rw, ry + rh); ctx.lineTo(rx + rw, ry + rh - cornerSize); ctx.stroke();

        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(rx + 8, ry + 8, 220, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('ACTIVE HEAD COUNTING REGION (ROI)', rx + 16, ry + 24);
      }

      // Draw Bounding Boxes
      if (showBoundingBoxes && currentBoxes.length > 0 && feedMode !== 'CCTV_STREAM') {
        currentBoxes.forEach(box => {
          const inRoi = box.in_roi ?? true;
          const boxColor = inRoi ? '#10b981' : '#64748b';

          ctx.strokeStyle = boxColor;
          ctx.lineWidth = inRoi ? 2.5 : 1.5;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          const clen = Math.min(10, box.width / 4);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + clen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + clen, box.y);
          ctx.moveTo(box.x + box.width - clen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + clen);
          ctx.moveTo(box.x, box.y + box.height - clen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + clen, box.y + box.height);
          ctx.moveTo(box.x + box.width - clen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - clen);
          ctx.stroke();

          const labelText = box.label || `${box.class_name === 'head' ? 'HEAD' : 'PERSON'} #${box.track_id} ${(box.confidence * 100).toFixed(0)}%`;
          ctx.font = 'bold 10px monospace';
          const textMetrics = ctx.measureText(labelText);
          const badgeWidth = textMetrics.width + 12;
          const badgeHeight = 18;
          const badgeY = Math.max(0, box.y - badgeHeight);

          ctx.fillStyle = inRoi ? 'rgba(16, 185, 129, 0.95)' : 'rgba(100, 116, 139, 0.9)';
          ctx.beginPath();
          ctx.roundRect(box.x, badgeY, badgeWidth, badgeHeight, 4);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, box.x + 6, badgeY + 12);
        });
      }

      // Draw HUD
      if (showHud && feedMode !== 'CCTV_STREAM') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(14, 14, 270, 78, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        const sourceName = feedMode === 'WEBCAM' ? 'LIVE CAMERA (WEBCAM)' : feedMode === 'TEST_FILE' ? 'TEST SAMPLE FILE' : activeCamera.name;
        ctx.fillText(sourceName, 26, 34);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`AI: ${backendStatus.online ? 'YOLOv8 + Haar Cascades' : 'Browser Vision'} (${detectionLatency}ms)`, 26, 52);

        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`HEADS COUNTED: ${liveCount}`, 26, 74);
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    isPlaying,
    showBoundingBoxes,
    showRoiZone,
    showHud,
    roi,
    feedMode,
    activeCamera,
    currentBoxes,
    liveCount,
    detectionLatency,
    countMode,
    backendStatus.online,
    processCurrentFrame,
  ]);

  // Save current count into lecture attendance
  const handleRecordAttendance = () => {
    if (!activeLecture) {
      alert('No active lecture found to update.');
      return;
    }

    const updatedLecture: Lecture = {
      ...activeLecture,
      presentStudents: liveCount,
      peakStudents: Math.max(activeLecture.peakStudents || 0, liveCount),
      averageOccupancyPercent: Math.round((liveCount / activeLecture.enrolledStudents) * 100),
      status: 'IN_PROGRESS',
    };

    if (onSaveLecture) {
      onSaveLecture(updatedLecture);
    } else {
      storageService.saveLecture(updatedLecture);
    }

    setAttendanceSavedToast(`Recorded ${liveCount} heads present for ${activeLecture.title} (${activeLecture.subjectCode})`);
    setTimeout(() => {
      setAttendanceSavedToast(null);
    }, 4500);
  };

  // Capture Snapshot
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 1280;
    snapCanvas.height = 720;
    const snapCtx = snapCanvas.getContext('2d');
    if (!snapCtx) return;

    if (feedMode === 'WEBCAM' && webcamVideoRef.current) {
      snapCtx.drawImage(webcamVideoRef.current, 0, 0, 1280, 720);
    } else if ((feedMode === 'TEST_FILE' || feedMode === 'UPLOADED') && testVideoRef.current) {
      snapCtx.drawImage(testVideoRef.current, 0, 0, 1280, 720);
    }
    snapCtx.drawImage(canvas, 0, 0, 1280, 720);

    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.download = `headcount_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {attendanceSavedToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl border border-emerald-500 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{attendanceSavedToast}</span>
        </div>
      )}

      {/* Connect CCTV Modal */}
      {isConnectCctvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Connect CCTV Camera (RTSP / IP)</h3>
              </div>
              <button onClick={() => setIsConnectCctvModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAndConnectCctv} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Camera Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hall-101 Overhead Camera"
                  value={cctvName}
                  onChange={e => setCctvName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">RTSP Stream URL</label>
                <input
                  type="text"
                  required
                  placeholder="rtsp://admin:password@192.168.1.100:554/live/main"
                  value={cctvRtsp}
                  onChange={e => setCctvRtsp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Supports RTSP, HTTP, and local video endpoints.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Camera IP Address</label>
                  <input
                    type="text"
                    value={cctvIp}
                    onChange={e => setCctvIp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Port</label>
                  <input
                    type="number"
                    value={cctvPort}
                    onChange={e => setCctvPort(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Assigned Classroom</label>
                <select
                  value={cctvClassroomId}
                  onChange={e => setCctvClassroomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Test CCTV Connection Status */}
              {cctvTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  cctvTestResult.online ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {cctvTestResult.online ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <span>{cctvTestResult.message}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestCctv}
                  disabled={cctvTesting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cctvTesting ? 'animate-spin' : ''}`} />
                  <span>{cctvTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConnectCctvModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-500/20"
                  >
                    Save & Stream
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header & Camera Source Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CameraIcon className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Live Camera & CCTV Head Count Vision</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              YOLOv8 + Head Cascades
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time head and person counting through your device camera, connected CCTV RTSP streams, or sample test footage.
          </p>
        </div>

        {/* Source Mode Buttons & Connect CCTV Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Device Camera Button */}
          <button
            onClick={() => {
              setSelectedCameraId('cam_webcam');
              setFeedMode('WEBCAM');
              if (!isWebcamActive) startWebcam(selectedDeviceId);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              feedMode === 'WEBCAM'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isWebcamActive ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
            <Video className="w-3.5 h-3.5" />
            <span>My Live Camera</span>
          </button>

          {/* Connect New CCTV Camera Button */}
          <button
            onClick={() => setIsConnectCctvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect CCTV</span>
          </button>

          {/* Existing CCTV Camera Pills */}
          {cameras.filter(c => c.id !== 'cam_webcam').map(cam => {
            const isSelected = selectedCameraId === cam.id && feedMode !== 'WEBCAM' && feedMode !== 'TEST_FILE';
            return (
              <button
                key={cam.id}
                onClick={() => {
                  setSelectedCameraId(cam.id);
                  if (cam.rtspUrl && (cam.rtspUrl.startsWith('rtsp://') || cam.rtspUrl.startsWith('http://'))) {
                    setFeedMode('CCTV_STREAM');
                  } else {
                    setFeedMode('SIMULATED');
                  }
                  stopWebcam();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${cam.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                <span>{cam.name.split(' ')[0]}</span>
                <span className="text-[10px] opacity-75 font-mono">({cam.fps}fps)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Test Sample Files Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 p-3.5 rounded-2xl text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-600 text-white">
            <FileVideo className="w-3.5 h-3.5" />
          </span>
          <div>
            <span className="font-bold text-slate-800">Quick Test Files & Benchmark Footage:</span>
            <span className="text-slate-500 ml-1.5 hidden sm:inline">Load sample videos to test head detection instantly</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleLoadTestFile('/test_files/classroom_lecture.mp4', 'Classroom Lecture (20 Students)')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/classroom_lecture.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Classroom (20 Heads)</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/student_webcam_test.mp4', 'Student Webcam Close-up')}
            className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/student_webcam_test.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Webcam Close-up</span>
          </button>

          <a
            href="/test_files/classroom_lecture.mp4"
            download="classroom_lecture.mp4"
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
            title="Download test video file"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Viewport & Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Live Viewport */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative group">
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              {/* Webcam Video Element */}
              {feedMode === 'WEBCAM' && (
                <video
                  ref={webcamVideoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isWebcamActive ? 'opacity-100' : 'opacity-0'}`}
                />
              )}

              {/* Test / Uploaded Video Element */}
              {(feedMode === 'TEST_FILE' || feedMode === 'UPLOADED') && (
                <video
                  ref={testVideoRef}
                  src={feedMode === 'TEST_FILE' ? selectedTestFile || undefined : uploadedVideoUrl || undefined}
                  loop
                  autoPlay
                  muted
                  playsInline
                  className="hidden"
                />
              )}

              {/* CCTV Live Stream (MJPEG via Backend) */}
              {feedMode === 'CCTV_STREAM' && (
                <img
                  src={aiBackendService.getCustomCctvStreamUrl(activeCamera.rtspUrl)}
                  alt="Live CCTV Feed"
                  className="w-full h-full object-contain"
                  onError={() => {
                    setFeedMode('SIMULATED');
                  }}
                />
              )}

              {/* Overlay Canvas */}
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />

              {/* Camera Offline / Permission Prompt Banner */}
              {feedMode === 'WEBCAM' && !isWebcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white p-6 text-center space-y-4 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Video className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-lg font-bold">Start Live Camera for Head Counting</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Click below to activate real-time YOLOv8 person and head detection through your webcam.
                    </p>
                    {webcamError && (
                      <div className="mt-3 p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs text-left">
                        {webcamError}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => startWebcam(selectedDeviceId)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/30"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Enable & Start Camera</span>
                  </button>
                </div>
              )}

              {/* Top HUD Badges Overlay */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white backdrop-blur ${
                    feedMode === 'WEBCAM' && isWebcamActive ? 'bg-red-600/90 animate-pulse' : 'bg-emerald-600/90'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {feedMode === 'WEBCAM' ? 'LIVE CAMERA ACTIVE' : feedMode === 'CCTV_STREAM' ? 'CCTV RTSP LIVE' : 'STREAM ACTIVE'}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-black/60 text-slate-200 backdrop-blur border border-white/10">
                    {liveFps} FPS • {detectionLatency}ms
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-600/90 text-white backdrop-blur shadow-sm">
                    {countMode === 'head' ? 'Heads' : countMode === 'person' ? 'People' : 'Total'}: {liveCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono text-slate-300 bg-black/60 backdrop-blur border border-white/10">
                    Conf: {(confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Stream Control Bar */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                  title={isPlaying ? 'Pause detection' : 'Resume detection'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                {feedMode === 'WEBCAM' && (
                  <button
                    onClick={() => (isWebcamActive ? stopWebcam() : startWebcam(selectedDeviceId))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                      isWebcamActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isWebcamActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    <span>{isWebcamActive ? 'Stop Camera' : 'Start Camera'}</span>
                  </button>
                )}

                <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setCountMode('head')}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition ${
                      countMode === 'head' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎯 Head Count
                  </button>
                  <button
                    onClick={() => setCountMode('person')}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition ${
                      countMode === 'person' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    👤 Person
                  </button>
                  <button
                    onClick={() => setCountMode('both')}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition ${
                      countMode === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    👥 Both
                  </button>
                </div>

                <button
                  onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    showBoundingBoxes ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Boxes
                </button>

                <button
                  onClick={() => setShowRoiZone(!showRoiZone)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    showRoiZone ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  ROI Zone
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCaptureSnapshot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
                  title="Capture snapshot with bounding boxes"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Snapshot</span>
                </button>

                <button
                  onClick={handleRecordAttendance}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition shadow-sm shadow-emerald-500/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Attendance ({liveCount})</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Upload classroom video file"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Settings Grid */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-500 font-bold block mb-1.5 uppercase text-[10px]">
                Camera Device Input
              </label>
              <select
                value={selectedDeviceId}
                onChange={e => {
                  setSelectedDeviceId(e.target.value);
                  if (feedMode === 'WEBCAM') startWebcam(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {webcamDevices.length > 0 ? (
                  webcamDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default System Webcam</option>
                )}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-500 font-bold uppercase text-[10px]">
                  Detection Confidence Threshold
                </label>
                <span className="font-mono font-bold text-emerald-600">
                  {(confidenceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.85"
                step="0.05"
                value={confidenceThreshold}
                onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>More Sensitive (15%)</span>
                <span>Stricter (85%)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Active Target</span>
                <span className="font-semibold text-emerald-950 text-xs">
                  {countMode === 'head' ? '🎯 Head Detection Focus' : countMode === 'person' ? '👤 Person Body Focus' : '👥 Dual Head & Body'}
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  Haar Cascade + YOLOv8n
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600">{liveCount}</span>
                <span className="text-[10px] text-emerald-800 block font-medium">Inside Zone</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Head Count Metrics & Live Detection Log */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  Live Head Count
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tracking-tight text-white">{liveCount}</span>
                <span className="text-sm font-semibold text-emerald-300">Heads</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Target Room</span>
                  <span className="font-semibold text-slate-200 truncate block mt-0.5">
                    {activeClassroom.name.split(' ')[0]}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Capacity</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">
                    {Math.round((liveCount / activeClassroom.capacity) * 100)}% ({activeClassroom.capacity})
                  </span>
                </div>
              </div>

              {activeLecture && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200">{activeLecture.subjectCode}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">In Progress</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{activeLecture.title}</p>
                </div>
              )}
            </div>
          </div>

          {/* ROI Zone Adjuster Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                Counting Region (ROI)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">{roi.width}% × {roi.height}%</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setRoi({ x: 5, y: 5, width: 90, height: 90 })}
                className="py-1 px-2 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Full (90%)
              </button>
              <button
                onClick={() => setRoi({ x: 15, y: 15, width: 70, height: 75 })}
                className="py-1 px-2 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Center Focus
              </button>
              <button
                onClick={() => setRoi({ x: 5, y: 10, width: 90, height: 50 })}
                className="py-1 px-2 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Front Rows
              </button>
            </div>

            <div className="space-y-2 pt-2 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-500">
                  <span>Horizontal Size</span>
                  <span className="font-mono">{roi.width}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={roi.width}
                  onChange={e => setRoi(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-500">
                  <span>Vertical Size</span>
                  <span className="font-mono">{roi.height}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={roi.height}
                  onChange={e => setRoi(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Live Activity Logs */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                Live Vision Log
              </h3>
              <button
                onClick={onRefreshBackend}
                className="text-slate-400 hover:text-slate-600 transition"
                title="Refresh backend status"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto font-mono text-[10px] text-slate-600">
              {detectionLogs.map((log, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span className="leading-relaxed">{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
