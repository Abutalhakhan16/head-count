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
  CheckCircle,
  AlertTriangle,
  Download,
  Crosshair,
  Save,
  Radio,
  Plus,
  X,
  FileVideo,
  Image as ImageIcon,
  CheckCircle2,
  BarChart2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Camera, Classroom, Lecture } from '../types';
import { aiBackendService, BackendStatus, DetectionBoxData } from '../services/aiBackendService';
import { visionEngine, VideoAnalysisReport } from '../services/visionEngine';
import { storageService } from '../services/storage';

interface CCTVMonitoringViewProps {
  cameras: Camera[];
  classrooms: Classroom[];
  lectures?: Lecture[];
  initialCameraId?: string | null;
  onSaveLecture?: (lecture: Lecture) => void;
  onSaveCamera?: (camera: Camera) => void;
  backendStatus: BackendStatus;
  onRefreshBackend: () => void;
}

type FeedMode = 'WEBCAM' | 'CCTV_STREAM' | 'SIMULATED' | 'UPLOADED' | 'TEST_FILE' | 'IMAGE_FILE';

interface DrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

function computeFitRect(srcW: number, srcH: number, dstW: number, dstH: number): DrawRect {
  if (!srcW || !srcH) return { dx: 0, dy: 0, dw: dstW, dh: dstH };
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const dw = Math.round(srcW * scale);
  const dh = Math.round(srcH * scale);
  const dx = Math.round((dstW - dw) / 2);
  const dy = Math.round((dstH - dh) / 2);
  return { dx, dy, dw, dh };
}

export const CCTVMonitoringView: React.FC<CCTVMonitoringViewProps> = ({
  cameras,
  classrooms,
  lectures = [],
  initialCameraId,
  onSaveLecture,
  onSaveCamera,
  backendStatus,
  onRefreshBackend,
}) => {
  const [selectedCameraId, setSelectedCameraId] = useState<string>(initialCameraId || cameras[0]?.id || 'cam_webcam');
  const [feedMode, setFeedMode] = useState<FeedMode>('TEST_FILE');
  const [countMode, setCountMode] = useState<'head' | 'person' | 'both'>('head');

  // AI Model loading state
  const [aiReady, setAiReady] = useState<boolean>(visionEngine.isReady());
  const [aiLoading, setAiLoading] = useState<boolean>(!visionEngine.isReady());
  const [aiError, setAiError] = useState<string | null>(null);

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

  // Video Timeline State
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Test Files & Uploaded Files State
  const [selectedTestFile, setSelectedTestFile] = useState<string | null>('/test_files/real_people_test.mp4');
  const [selectedTestLabel, setSelectedTestLabel] = useState<string>('Real People Stream');
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [imageSourceUrl, setImageSourceUrl] = useState<string | null>(null);
  const [imageSourceName, setImageSourceName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch Video Analysis State
  const [analyzingVideo, setAnalyzingVideo] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [videoReport, setVideoReport] = useState<VideoAnalysisReport | null>(null);

  // CCTV Stream State
  const [cctvConnecting, setCctvConnecting] = useState<boolean>(false);
  const [cctvFallbackNotice, setCctvFallbackNotice] = useState<string | null>(null);
  const [cctvStreamNonce, setCctvStreamNonce] = useState<number>(0);

  // Connect CCTV Modal State
  const [isConnectCctvModalOpen, setIsConnectCctvModalOpen] = useState(false);
  const [cctvName, setCctvName] = useState('');
  const [cctvRtsp, setCctvRtsp] = useState('demo://classroom_lecture');
  const [cctvIp, setCctvIp] = useState('192.168.1.100');
  const [cctvPort, setCctvPort] = useState(554);
  const [cctvClassroomId, setCctvClassroomId] = useState(classrooms[0]?.id || 'cls_101');
  const [cctvTesting, setCctvTesting] = useState(false);
  const [cctvTestResult, setCctvTestResult] = useState<{ online: boolean; message: string } | null>(null);

  // HTML Element Refs
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const cctvImgRef = useRef<HTMLImageElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);
  const currentBoxesRef = useRef<DetectionBoxData[]>([]);
  const liveCountRef = useRef<number>(0);

  // Live Detected Count State
  const [liveCount, setLiveCount] = useState<number>(0);
  const [headCount, setHeadCount] = useState<number>(0);
  const [personCount, setPersonCount] = useState<number>(0);
  const [totalTrackedEver, setTotalTrackedEver] = useState<number>(0);
  const [liveFps, setLiveFps] = useState<number>(24);
  const [detectionLatency, setDetectionLatency] = useState<number>(28);
  const [currentBoxes, setCurrentBoxes] = useState<DetectionBoxData[]>([]);
  const [attendanceSavedToast, setAttendanceSavedToast] = useState<string | null>(null);
  const [targetLectureId, setTargetLectureId] = useState<string>(
    lectures.find((l) => l.status === 'IN_PROGRESS')?.id || lectures[0]?.id || ''
  );

  // Activity Logs
  const [detectionLogs, setDetectionLogs] = useState<string[]>([
    'Initializing TensorFlow.js COCO-SSD + BlazeFace vision models...',
    'FFmpeg RTSP/HTTP CCTV stream proxy ready on /api/cctv/stream',
  ]);

  const appendLog = useCallback((msg: string) => {
    setDetectionLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 11)]);
  }, []);

  const activeCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const activeClassroom = classrooms.find((c) => c.id === activeCamera?.classroomId) || classrooms[0];
  const activeLecture = lectures.find((l) => l.id === targetLectureId) || lectures.find((l) => l.status === 'IN_PROGRESS') || lectures[0];

  // ROI Zone (percentage 0-100)
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number }>({
    x: activeCamera?.roiZone?.x ?? 5,
    y: activeCamera?.roiZone?.y ?? 5,
    width: activeCamera?.roiZone?.width ?? 90,
    height: activeCamera?.roiZone?.height ?? 90,
  });

  // Load TensorFlow.js models on mount
  useEffect(() => {
    let mounted = true;
    setAiLoading(true);
    visionEngine.ensureLoaded().then((ok) => {
      if (!mounted) return;
      setAiLoading(false);
      setAiReady(ok);
      if (ok) {
        setAiError(null);
        appendLog('AI Vision Ready: COCO-SSD + BlazeFace models loaded in browser');
      } else {
        const err = visionEngine.getLoadError() || 'Unable to load TensorFlow.js weights';
        setAiError(err);
        appendLog(`AI Model warning: ${err}`);
      }
    });
    return () => {
      mounted = false;
    };
  }, [appendLog]);

  // Keep refs synced for synchronous canvas render loop
  useEffect(() => {
    currentBoxesRef.current = currentBoxes;
  }, [currentBoxes]);

  useEffect(() => {
    liveCountRef.current = liveCount;
  }, [liveCount]);

  // Query available video cameras on mount
  useEffect(() => {
    async function getDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
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
  }, [selectedDeviceId]);

  // Handle initialCameraId passed from Classrooms & RTSP view
  useEffect(() => {
    if (initialCameraId) {
      selectCameraSource(initialCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraId]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  }, []);

  const startWebcam = useCallback(
    async (deviceId?: string) => {
      try {
        setWebcamError(null);
        stopWebcam();
        visionEngine.resetTracker();
        setCurrentBoxes([]);
        setVideoReport(null);

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
        appendLog('Live Camera started: Browser WebRTC webcam active');
      } catch (err: any) {
        console.error('Webcam start error:', err);
        setWebcamError(err.message || 'Could not access camera. Please allow camera permissions in your browser.');
        setIsWebcamActive(false);
      }
    },
    [stopWebcam, appendLog]
  );

  // Switch camera source explicitly
  const selectCameraSource = useCallback(
    (camId: string) => {
      setSelectedCameraId(camId);
      setCctvFallbackNotice(null);
      setVideoReport(null);
      setCurrentBoxes([]);
      visionEngine.resetTracker();

      if (camId === 'cam_webcam') {
        setFeedMode('WEBCAM');
        return;
      }

      stopWebcam();
      const cam = cameras.find((c) => c.id === camId);
      if (cam) {
        if (cam.roiZone) setRoi(cam.roiZone);
        if (
          cam.rtspUrl &&
          (cam.rtspUrl.startsWith('rtsp://') ||
            cam.rtspUrl.startsWith('rtsps://') ||
            cam.rtspUrl.startsWith('http://') ||
            cam.rtspUrl.startsWith('https://') ||
            cam.rtspUrl.startsWith('demo://'))
        ) {
          setFeedMode('CCTV_STREAM');
          setCctvConnecting(true);
          setCctvStreamNonce((n) => n + 1);
          setIsPlaying(true);
          appendLog(`Connecting to CCTV stream: ${cam.name} (${cam.rtspUrl})`);
        } else {
          setFeedMode('SIMULATED');
          setIsPlaying(true);
        }
      }
    },
    [cameras, stopWebcam, appendLog]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (uploadedFileUrl && uploadedFileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedFileUrl);
      }
    };
  }, [stopWebcam, uploadedFileUrl]);

  // Reload & auto-play video element when test/uploaded video changes
  useEffect(() => {
    const vid = testVideoRef.current;
    if (!vid) return;
    if (feedMode === 'TEST_FILE' || feedMode === 'UPLOADED') {
      vid.load();
      if (isPlaying) {
        vid.play().catch(() => {});
      }
    }
  }, [selectedTestFile, uploadedFileUrl, feedMode]);

  // Sync play/pause state with actual HTMLVideoElement
  useEffect(() => {
    const vid = feedMode === 'WEBCAM' ? webcamVideoRef.current : testVideoRef.current;
    if (!vid) return;
    if (isPlaying) {
      if (vid.paused && vid.readyState >= 2) {
        vid.play().catch(() => {});
      }
    } else if (!vid.paused) {
      vid.pause();
    }
  }, [isPlaying, feedMode]);

  // Load image element when IMAGE_FILE changes
  useEffect(() => {
    if (feedMode !== 'IMAGE_FILE' || !imageSourceUrl) {
      loadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      runSingleImageDetection(img);
    };
    img.src = imageSourceUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMode, imageSourceUrl]);

  // Re-run image detection when parameters change while viewing a static image
  const runSingleImageDetection = useCallback(
    async (imgEl?: HTMLImageElement) => {
      const img = imgEl || loadedImageRef.current;
      if (!img || !img.complete || img.naturalWidth === 0) return;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const oc = offscreenCanvasRef.current;
      oc.width = 1280;
      oc.height = 720;
      const octx = oc.getContext('2d');
      if (!octx) return;

      octx.fillStyle = '#020617';
      octx.fillRect(0, 0, 1280, 720);
      const fit = computeFitRect(img.naturalWidth, img.naturalHeight, 1280, 720);
      octx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);

      const res = await visionEngine.detectFrame(oc, {
        mode: countMode,
        confidence: confidenceThreshold,
        roi,
        frameWidth: 1280,
        frameHeight: 720,
      });

      setCurrentBoxes(res.boxes);
      setLiveCount(res.count);
      setHeadCount(res.head_count ?? res.count);
      setPersonCount(res.person_count ?? 0);
      setDetectionLatency(res.processing_time_ms);
      setLiveFps(res.fps || 24);
    },
    [countMode, confidenceThreshold, roi]
  );

  useEffect(() => {
    if (feedMode === 'IMAGE_FILE' && loadedImageRef.current) {
      runSingleImageDetection();
    }
  }, [feedMode, countMode, confidenceThreshold, roi, aiReady, runSingleImageDetection]);

  // Handle custom uploaded video or image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopWebcam();
    setCctvFallbackNotice(null);
    setVideoReport(null);
    setCurrentBoxes([]);
    visionEngine.resetTracker();

    const objectUrl = URL.createObjectURL(file);
    if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      setImageSourceUrl(objectUrl);
      setImageSourceName(file.name);
      setFeedMode('IMAGE_FILE');
      setIsPlaying(true);
      appendLog(`Loaded uploaded image for head detection: ${file.name}`);
    } else {
      if (uploadedFileUrl && uploadedFileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedFileUrl);
      }
      setUploadedFileUrl(objectUrl);
      setUploadedFileName(file.name);
      setFeedMode('UPLOADED');
      setIsPlaying(true);
      appendLog(`Loaded uploaded video file: ${file.name}`);
    }
    e.target.value = '';
  };

  // Load built-in test video or image asset
  const handleLoadTestFile = (path: string, name: string, type: 'video' | 'image' = 'video') => {
    stopWebcam();
    setCctvFallbackNotice(null);
    setVideoReport(null);
    setCurrentBoxes([]);
    visionEngine.resetTracker();

    if (type === 'image') {
      setImageSourceUrl(path);
      setImageSourceName(name);
      setFeedMode('IMAGE_FILE');
      setIsPlaying(true);
      appendLog(`Loaded Test Image: ${name}`);
    } else {
      setSelectedTestFile(path);
      setSelectedTestLabel(name);
      setFeedMode('TEST_FILE');
      setIsPlaying(true);
      appendLog(`Loaded Test Video: ${name}`);
    }
  };

  // Batch-analyze entire video file
  const handleAnalyzeFullVideo = async () => {
    const sourceUrl = feedMode === 'TEST_FILE' ? selectedTestFile : feedMode === 'UPLOADED' ? uploadedFileUrl : null;
    if (!sourceUrl) return;

    setAnalyzingVideo(true);
    setAnalysisProgress(0);
    setVideoReport(null);
    appendLog(`Starting full video attendance scan (${feedMode === 'TEST_FILE' ? selectedTestLabel : uploadedFileName})...`);

    try {
      const report = await visionEngine.analyzeVideoSource(sourceUrl, {
        mode: countMode,
        confidence: confidenceThreshold,
        roi,
        onProgress: (pct) => setAnalysisProgress(pct),
      });
      setVideoReport(report);
      appendLog(
        `Video scan complete: Avg ${report.averageAttendance}, Peak ${report.peakAttendance} heads across ${report.samplesAnalyzed} samples`
      );
    } catch (err: any) {
      appendLog(`Video scan failed: ${err?.message || 'Unable to decode video'}`);
    } finally {
      setAnalyzingVideo(false);
    }
  };

  // Test CCTV connection via backend ffprobe
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
    const assignedClassroom = classrooms.find((c) => c.id === cctvClassroomId);
    const newCamId = `cctv_${Date.now()}`;
    const newCamera: Camera = {
      id: newCamId,
      name: cctvName || `CCTV Stream ${cameras.length + 1}`,
      classroomId: cctvClassroomId,
      classroomName: assignedClassroom ? assignedClassroom.name : 'Classroom',
      rtspUrl: cctvRtsp.trim(),
      ipAddress: cctvIp,
      port: Number(cctvPort) || 554,
      status: 'ONLINE',
      resolution: '1280x720 (HD)',
      fps: 30,
      bitrate: '4.8 Mbps',
      latencyMs: 95,
      lastPing: 'Just now',
      roiZone: { x: 5, y: 10, width: 90, height: 85 },
    };

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
    setCctvFallbackNotice(null);
    setFeedMode('CCTV_STREAM');
    setCctvConnecting(true);
    setCctvStreamNonce((n) => n + 1);
    setIsPlaying(true);
    setIsConnectCctvModalOpen(false);
    visionEngine.resetTracker();
    appendLog(`Connected CCTV: ${newCamera.name} (${newCamera.rtspUrl})`);
  };

  // Real-time AI Detection on the drawn offscreen/display frame (Works for Webcam, Video Files, and MJPEG CCTV Streams!)
  const processSourceFrame = useCallback(
    async (source: HTMLVideoElement | HTMLImageElement, srcW: number, srcH: number) => {
      if (processingRef.current || !aiReady) return;
      processingRef.current = true;

      try {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const oc = offscreenCanvasRef.current;
        const detectW = 640;
        const detectH = 360;
        oc.width = detectW;
        oc.height = detectH;
        const octx = oc.getContext('2d');
        if (!octx) return;

        octx.fillStyle = '#020617';
        octx.fillRect(0, 0, detectW, detectH);
        const fit = computeFitRect(srcW, srcH, detectW, detectH);
        octx.drawImage(source, fit.dx, fit.dy, fit.dw, fit.dh);

        const result = await visionEngine.detectFrame(oc, {
          mode: countMode,
          confidence: confidenceThreshold,
          roi,
          frameWidth: detectW,
          frameHeight: detectH,
        });

        const scaleX = 1280 / detectW;
        const scaleY = 720 / detectH;

        const scaledBoxes: DetectionBoxData[] = result.boxes.map((b) => ({
          ...b,
          x: Math.round(b.x * scaleX),
          y: Math.round(b.y * scaleY),
          width: Math.round(b.width * scaleX),
          height: Math.round(b.height * scaleY),
          head_box: b.head_box
            ? {
                x: Math.round(b.head_box.x * scaleX),
                y: Math.round(b.head_box.y * scaleY),
                width: Math.round(b.head_box.width * scaleX),
                height: Math.round(b.head_box.height * scaleY),
              }
            : undefined,
        }));

        setCurrentBoxes(scaledBoxes);
        setLiveCount(result.count);
        setHeadCount(result.head_count ?? result.count);
        setPersonCount(result.person_count ?? 0);
        if (result.total_unique_tracked !== undefined) {
          setTotalTrackedEver(result.total_unique_tracked);
        }
        setDetectionLatency(result.processing_time_ms);
        setLiveFps(Math.min(30, Math.max(1, Math.round(1000 / Math.max(1, result.processing_time_ms)))));
      } catch (err) {
        console.warn('Frame detection error:', err);
      } finally {
        processingRef.current = false;
      }
    },
    [aiReady, countMode, confidenceThreshold, roi]
  );

  // Trigger single-frame re-detection when paused and user tweaks ROI / Confidence / Mode
  useEffect(() => {
    if (!isPlaying && (feedMode === 'TEST_FILE' || feedMode === 'UPLOADED')) {
      const vid = testVideoRef.current;
      if (vid && vid.readyState >= 2) {
        processSourceFrame(vid, vid.videoWidth, vid.videoHeight);
      }
    }
  }, [isPlaying, feedMode, countMode, confidenceThreshold, roi, processSourceFrame]);

  // Main Canvas Render & Detection Loop
  useEffect(() => {
    let lastProcessTime = 0;
    const processIntervalMs = 140;
    let simTick = 0;
    let cancelled = false;

    const renderLoop = (time: number) => {
      if (cancelled) return;
      simTick += 0.03;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      if (feedMode === 'WEBCAM' && webcamVideoRef.current && webcamVideoRef.current.readyState >= 2) {
        const v = webcamVideoRef.current;
        const fit = computeFitRect(v.videoWidth, v.videoHeight, width, height);
        ctx.drawImage(v, fit.dx, fit.dy, fit.dw, fit.dh);
        if (isPlaying && time - lastProcessTime > processIntervalMs) {
          lastProcessTime = time;
          processSourceFrame(v, v.videoWidth, v.videoHeight);
        }
      } else if ((feedMode === 'TEST_FILE' || feedMode === 'UPLOADED') && testVideoRef.current && testVideoRef.current.readyState >= 2) {
        const v = testVideoRef.current;
        const fit = computeFitRect(v.videoWidth, v.videoHeight, width, height);
        ctx.drawImage(v, fit.dx, fit.dy, fit.dw, fit.dh);
        if (isPlaying && !v.paused && time - lastProcessTime > processIntervalMs) {
          lastProcessTime = time;
          processSourceFrame(v, v.videoWidth, v.videoHeight);
        }
      } else if (feedMode === 'IMAGE_FILE' && loadedImageRef.current && loadedImageRef.current.complete) {
        const img = loadedImageRef.current;
        const fit = computeFitRect(img.naturalWidth, img.naturalHeight, width, height);
        ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
      } else if (feedMode === 'CCTV_STREAM' && cctvImgRef.current && cctvImgRef.current.complete && cctvImgRef.current.naturalWidth > 0) {
        const img = cctvImgRef.current;
        const fit = computeFitRect(img.naturalWidth, img.naturalHeight, width, height);
        ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
        if (isPlaying && time - lastProcessTime > processIntervalMs) {
          lastProcessTime = time;
          processSourceFrame(img, img.naturalWidth, img.naturalHeight);
        }
      } else if (feedMode === 'SIMULATED') {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.2, '#1e293b');
        bgGrad.addColorStop(0.35, '#334155');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(width * 0.28, height * 0.04, width * 0.44, height * 0.14);
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText(`${activeCamera?.classroomName || 'Lecture Hall'} • Simulated CCTV Feed`, width * 0.30, height * 0.12);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 6; i++) {
          const yPos = height * (0.22 + i * 0.12);
          ctx.beginPath();
          ctx.moveTo(width * 0.06, yPos);
          ctx.lineTo(width * 0.94, yPos);
          ctx.stroke();
        }

        const simBoxes: DetectionBoxData[] = [];
        let sid = 1;
        const rows = 5;
        const cols = 14;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const bx = (0.12 + c * 0.055 + r * 0.005) * width;
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
            const inRoi = hx + hw / 2 >= rx && hy + hh / 2 >= ry && hx + hw / 2 <= rx + rw && hy + hh / 2 <= ry + rh;

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

        const insideSim = simBoxes.filter((b) => b.in_roi).length;
        if (insideSim !== liveCountRef.current) {
          setLiveCount(insideSim);
          setHeadCount(insideSim);
        }
        currentBoxesRef.current = simBoxes;
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
        ctx.roundRect(rx + 8, ry + 8, 226, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('ACTIVE HEAD COUNTING REGION (ROI)', rx + 16, ry + 24);
      }

      // Draw Bounding Boxes
      const boxesToDraw = currentBoxesRef.current;
      if (showBoundingBoxes && boxesToDraw.length > 0) {
        boxesToDraw.forEach((box) => {
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

          const labelText =
            box.label ||
            `${box.class_name === 'head' ? 'HEAD' : 'PERSON'} #${box.track_id} ${(box.confidence * 100).toFixed(0)}%`;
          ctx.font = 'bold 11px monospace';
          const textMetrics = ctx.measureText(labelText);
          const badgeWidth = textMetrics.width + 12;
          const badgeHeight = 18;
          const badgeY = Math.max(0, box.y - badgeHeight);

          ctx.fillStyle = inRoi ? 'rgba(16, 185, 129, 0.95)' : 'rgba(100, 116, 139, 0.9)';
          ctx.beginPath();
          ctx.roundRect(box.x, badgeY, badgeWidth, badgeHeight, 4);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, box.x + 6, badgeY + 13);
        });
      }

      // Draw HUD
      if (showHud) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(14, 14, 290, 78, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        const sourceName =
          feedMode === 'WEBCAM'
            ? 'LIVE CAMERA (WEBCAM)'
            : feedMode === 'TEST_FILE'
            ? `VIDEO: ${selectedTestLabel}`
            : feedMode === 'UPLOADED'
            ? `UPLOADED: ${uploadedFileName || 'Video'}`
            : feedMode === 'IMAGE_FILE'
            ? `IMAGE: ${imageSourceName || 'Photo'}`
            : feedMode === 'CCTV_STREAM'
            ? `CCTV: ${activeCamera?.name || 'Stream'}`
            : activeCamera?.name || 'Simulated Classroom';
        ctx.fillText(sourceName.slice(0, 36), 26, 34);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(
          `AI: ${feedMode === 'SIMULATED' ? 'Classroom Simulator' : aiReady ? 'COCO-SSD + BlazeFace' : 'Loading...'} (${detectionLatency}ms)`,
          26,
          52
        );

        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`COUNTED IN ROI: ${liveCountRef.current}`, 26, 74);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelled = true;
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
    detectionLatency,
    countMode,
    aiReady,
    selectedTestLabel,
    uploadedFileName,
    imageSourceName,
    processSourceFrame,
  ]);

  // Save current count (or video peak/avg) into lecture attendance
  const handleRecordAttendance = (overrideCount?: number) => {
    if (!activeLecture) {
      setAttendanceSavedToast('No lecture available to save attendance.');
      setTimeout(() => setAttendanceSavedToast(null), 3500);
      return;
    }

    const countToSave = overrideCount !== undefined ? overrideCount : liveCount;
    const updatedLecture: Lecture = {
      ...activeLecture,
      presentStudents: countToSave,
      peakStudents: Math.max(activeLecture.peakStudents || 0, countToSave),
      averageOccupancyPercent: Math.round((countToSave / Math.max(1, activeLecture.enrolledStudents)) * 100),
      status: 'IN_PROGRESS',
    };

    if (onSaveLecture) {
      onSaveLecture(updatedLecture);
    } else {
      storageService.saveLecture(updatedLecture);
    }

    storageService.addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'DETECTION',
      message: `Saved ${countToSave} heads for ${activeLecture.subjectCode} (${activeLecture.title})`,
    });

    setAttendanceSavedToast(`Saved ${countToSave} heads present for ${activeLecture.subjectCode} (${activeLecture.title})`);
    setTimeout(() => {
      setAttendanceSavedToast(null);
    }, 4500);
  };

  // Capture Snapshot directly from composite canvas
  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.download = `headcount_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  const handleSeekVideo = (newTime: number) => {
    const vid = testVideoRef.current;
    if (!vid) return;
    vid.currentTime = newTime;
    setVideoCurrentTime(newTime);
    if (vid.paused) {
      vid.onseeked = () => {
        processSourceFrame(vid, vid.videoWidth, vid.videoHeight);
        vid.onseeked = null;
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {attendanceSavedToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl border border-emerald-500">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{attendanceSavedToast}</span>
        </div>
      )}

      {/* Connect CCTV Modal */}
      {isConnectCctvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Connect CCTV Camera (RTSP / HTTP / Demo)</h3>
              </div>
              <button onClick={() => setIsConnectCctvModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAndConnectCctv} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Quick Demo CCTV Presets (Live FFmpeg MJPEG)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Demo Classroom Stream', url: 'demo://classroom_lecture', name: 'LH-101 Demo Stream' },
                    { label: 'Demo People Stream', url: 'demo://real_people', name: 'Corridor People CCTV' },
                    { label: 'Demo Crowd Stream', url: 'demo://crowd_group', name: 'Campus Plaza CCTV' },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setCctvRtsp(preset.url);
                        if (!cctvName) setCctvName(preset.name);
                        setCctvTestResult(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                        cctvRtsp === preset.url
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Camera Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hall-101 Overhead Camera"
                  value={cctvName}
                  onChange={(e) => setCctvName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Stream URL (RTSP / HTTP / HLS / Demo)</label>
                <input
                  type="text"
                  required
                  placeholder="rtsp://admin:password@camera-ip:554/live/main"
                  value={cctvRtsp}
                  onChange={(e) => {
                    setCctvRtsp(e.target.value);
                    setCctvTestResult(null);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports live RTSP (`rtsp://`), HTTP MJPEG/MP4/HLS (`http://` / `https://`), and `demo://` test CCTV streams via FFmpeg.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Camera IP / Host</label>
                  <input
                    type="text"
                    value={cctvIp}
                    onChange={(e) => setCctvIp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Port</label>
                  <input
                    type="number"
                    value={cctvPort}
                    onChange={(e) => setCctvPort(parseInt(e.target.value, 10) || 554)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Assigned Classroom</label>
                <select
                  value={cctvClassroomId}
                  onChange={(e) => setCctvClassroomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {cctvTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    cctvTestResult.online
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {cctvTestResult.online ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
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
                  <span>{cctvTesting ? 'Probing Stream...' : 'Test Connection'}</span>
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CameraIcon className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Live Camera & CCTV Head Count Vision</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${
                aiReady
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : aiLoading
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {aiReady ? 'AI Vision Ready (COCO-SSD + BlazeFace)' : aiLoading ? 'Loading AI Models...' : 'AI Model Warning'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time head and person counting on live CCTV RTSP/HTTP streams, browser webcam, or uploaded video/image files.
          </p>
          {aiError && <p className="text-[11px] text-amber-700 mt-1">{aiError}</p>}
        </div>

        {/* Source Mode Buttons & Connect CCTV Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              selectCameraSource('cam_webcam');
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

          <button
            onClick={() => {
              setCctvTestResult(null);
              setIsConnectCctvModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect CCTV</span>
          </button>

          {cameras
            .filter((c) => c.id !== 'cam_webcam')
            .map((cam) => {
              const isSelected =
                selectedCameraId === cam.id && (feedMode === 'CCTV_STREAM' || feedMode === 'SIMULATED');
              return (
                <button
                  key={cam.id}
                  onClick={() => selectCameraSource(cam.id)}
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

      {/* Test Sample Files & Upload Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 p-3.5 rounded-2xl text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
            <FileVideo className="w-3.5 h-3.5" />
          </span>
          <div>
            <span className="font-bold text-slate-800">Test Video & Image Files:</span>
            <span className="text-slate-500 ml-1.5">Run real AI headcount detection on footage or upload your own</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleLoadTestFile('/test_files/real_people_test.mp4', 'Real People Stream', 'video')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/real_people_test.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Real People</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/crowd_group_test.mp4', 'Crowd Group Stream', 'video')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/crowd_group_test.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Crowd Group</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/classroom_lecture.mp4', 'Classroom Lecture', 'video')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/classroom_lecture.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Classroom</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/student_webcam_test.mp4', 'Webcam Close-up', 'video')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              selectedTestFile === '/test_files/student_webcam_test.mp4' && feedMode === 'TEST_FILE'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Close-up</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/people_heads_sample.jpg', 'People Heads Sample', 'image')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              imageSourceUrl === '/test_files/people_heads_sample.jpg' && feedMode === 'IMAGE_FILE'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            <span>Heads Photo</span>
          </button>

          <button
            onClick={() => handleLoadTestFile('/test_files/crowd_group_sample.jpg', 'Street Group Sample', 'image')}
            className={`px-2.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
              imageSourceUrl === '/test_files/crowd_group_sample.jpg' && feedMode === 'IMAGE_FILE'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            <span>Street Photo</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3 h-3" />
            <span>Upload Video / Photo</span>
          </button>
        </div>
      </div>

      {/* CCTV LAN Fallback Banner */}
      {cctvFallbackNotice && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{cctvFallbackNotice}</span>
          </div>
          <button
            onClick={() => {
              setCctvRtsp('demo://real_people');
              setCctvName('Live Demo CCTV (FFmpeg MJPEG)');
              setCctvTestResult(null);
              setIsConnectCctvModalOpen(true);
            }}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
          >
            Stream Demo CCTV via FFmpeg
          </button>
        </div>
      )}

      {/* Main Viewport & Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Live Viewport */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative group">
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              {/* Hidden Webcam Video Element (rendered on composite canvas) */}
              <video
                ref={webcamVideoRef}
                playsInline
                muted
                autoPlay
                className="hidden"
              />

              {/* Hidden Test / Uploaded Video Element (rendered on composite canvas) */}
              <video
                ref={testVideoRef}
                src={
                  feedMode === 'TEST_FILE'
                    ? selectedTestFile || undefined
                    : feedMode === 'UPLOADED'
                    ? uploadedFileUrl || undefined
                    : undefined
                }
                loop
                autoPlay
                muted
                playsInline
                crossOrigin="anonymous"
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  setVideoDuration(vid.duration || 0);
                  setVideoCurrentTime(0);
                }}
                onTimeUpdate={(e) => {
                  setVideoCurrentTime(e.currentTarget.currentTime);
                }}
                className="hidden"
              />

              {/* Hidden CCTV Live MJPEG Stream Image (rendered on composite canvas with AI boxes) */}
              {feedMode === 'CCTV_STREAM' && activeCamera && (
                <img
                  key={`${activeCamera.id}-${cctvStreamNonce}`}
                  ref={cctvImgRef}
                  crossOrigin="anonymous"
                  src={aiBackendService.getCustomCctvStreamUrl(activeCamera.rtspUrl)}
                  alt="Live CCTV Feed"
                  className="hidden"
                  onLoad={() => {
                    setCctvConnecting(false);
                    setCctvFallbackNotice(null);
                  }}
                  onError={() => {
                    setCctvConnecting(false);
                    setCctvFallbackNotice(
                      `Stream ${activeCamera.rtspUrl} is unreachable from this cloud server (private LAN IP or offline). Switched to Simulated Classroom CCTV.`
                    );
                    setFeedMode('SIMULATED');
                    appendLog(`RTSP unreachable (${activeCamera.rtspUrl}) — switched to Simulated Classroom CCTV`);
                  }}
                />
              )}

              {/* Composite Canvas (Video/Image + ROI + Real AI Bounding Boxes + HUD) */}
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full object-contain"
              />

              {/* CCTV Connecting Overlay */}
              {feedMode === 'CCTV_STREAM' && cctvConnecting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white z-10 gap-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-xs font-semibold">Connecting to CCTV stream via FFmpeg proxy...</p>
                </div>
              )}

              {/* Webcam Permission Prompt Banner */}
              {feedMode === 'WEBCAM' && !isWebcamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white p-6 text-center space-y-4 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Video className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-lg font-bold">Start Live Camera for Head Counting</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Click below to activate real-time TensorFlow.js person and head detection through your webcam.
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
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white backdrop-blur ${
                      feedMode === 'WEBCAM' && isWebcamActive
                        ? 'bg-red-600/90'
                        : feedMode === 'CCTV_STREAM'
                        ? 'bg-blue-600/90'
                        : 'bg-emerald-600/90'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {feedMode === 'WEBCAM'
                      ? 'LIVE WEBCAM'
                      : feedMode === 'CCTV_STREAM'
                      ? 'CCTV RTSP/HTTP LIVE'
                      : feedMode === 'TEST_FILE'
                      ? 'TEST VIDEO'
                      : feedMode === 'UPLOADED'
                      ? 'UPLOADED VIDEO'
                      : feedMode === 'IMAGE_FILE'
                      ? 'IMAGE TEST'
                      : 'SIMULATED CCTV'}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-black/60 text-slate-200 backdrop-blur border border-white/10">
                    {liveFps} FPS • {detectionLatency}ms
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-600/90 text-white backdrop-blur shadow-sm">
                    {countMode === 'head' ? 'Heads' : countMode === 'person' ? 'People' : 'Detected'}: {liveCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono text-slate-300 bg-black/60 backdrop-blur border border-white/10">
                    Conf: {(confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Video Scrub Timeline Bar (for TEST_FILE / UPLOADED) */}
            {(feedMode === 'TEST_FILE' || feedMode === 'UPLOADED') && videoDuration > 0 && (
              <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center gap-3 text-[11px] font-mono text-slate-300">
                <span>{videoCurrentTime.toFixed(1)}s</span>
                <input
                  type="range"
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  value={videoCurrentTime}
                  onChange={(e) => handleSeekVideo(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span>{videoDuration.toFixed(1)}s</span>
                <button
                  onClick={handleAnalyzeFullVideo}
                  disabled={analyzingVideo || !aiReady}
                  className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-sans font-semibold text-[11px] transition"
                >
                  {analyzingVideo ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Scanning {analysisProgress}%</span>
                    </>
                  ) : (
                    <>
                      <BarChart2 className="w-3 h-3" />
                      <span>Analyze Full Video</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Bottom Stream Control Bar */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {feedMode !== 'IMAGE_FILE' && (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                    title={isPlaying ? 'Pause stream & inspect frame' : 'Resume stream'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                )}

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
                    Head Count
                  </button>
                  <button
                    onClick={() => setCountMode('person')}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition ${
                      countMode === 'person' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Person
                  </button>
                  <button
                    onClick={() => setCountMode('both')}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition ${
                      countMode === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Both
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

                <button
                  onClick={() => setShowHud(!showHud)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    showHud ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  HUD
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
                  onClick={() => handleRecordAttendance()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition shadow-sm shadow-emerald-500/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Attendance ({liveCount})</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/quicktime,video/*,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Upload classroom video or image file"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Batch Video Analysis Summary Panel */}
          {videoReport && (
            <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Full Video Attendance Analysis ({videoReport.durationSeconds}s • {videoReport.samplesAnalyzed} Samples)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRecordAttendance(videoReport.peakAttendance)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                  >
                    Save Peak ({videoReport.peakAttendance}) to Lecture
                  </button>
                  <button
                    onClick={() => handleRecordAttendance(videoReport.averageAttendance)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                  >
                    Save Avg ({videoReport.averageAttendance}) to Lecture
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Average Count</span>
                  <span className="text-xl font-extrabold text-slate-900">{videoReport.averageAttendance}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-emerald-700 font-bold uppercase text-[10px] block">Peak Attendance</span>
                  <span className="text-xl font-extrabold text-emerald-700">{videoReport.peakAttendance}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-amber-700 font-bold uppercase text-[10px] block">Lowest Sample</span>
                  <span className="text-xl font-extrabold text-amber-700">{videoReport.lowestAttendance}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-blue-700 font-bold uppercase text-[10px] block">Unique Tracked</span>
                  <span className="text-xl font-extrabold text-blue-700">{videoReport.uniqueStudentsTracked}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                {videoReport.samples.map((s, idx) => (
                  <span key={idx} className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {s.timestampSec}s: <strong className="text-blue-700">{s.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Settings Grid */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-500 font-bold block mb-1.5 uppercase text-[10px]">
                Target Lecture for Attendance
              </label>
              <select
                value={targetLectureId}
                onChange={(e) => setTargetLectureId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {lectures.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.subjectCode} - {lec.title} ({lec.dayOfWeek})
                  </option>
                ))}
              </select>
              {feedMode === 'WEBCAM' && webcamDevices.length > 0 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    startWebcam(e.target.value);
                  }}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px]"
                >
                  {webcamDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Webcam ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
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
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
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
                  {countMode === 'head'
                    ? 'Head Detection Focus'
                    : countMode === 'person'
                    ? 'Person Body Focus'
                    : 'Dual Head & Body'}
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  {feedMode === 'SIMULATED' ? 'Classroom Simulator' : 'COCO-SSD + BlazeFace'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600">{liveCount}</span>
                <span className="text-[10px] text-emerald-800 block font-medium">
                  Inside Zone {headCount !== personCount && personCount > 0 ? `(${personCount} bodies)` : ''}
                </span>
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
                <span className="text-sm font-semibold text-emerald-300">
                  {countMode === 'person' ? 'People' : 'Heads'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Unique Tracked</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">
                    {Math.max(liveCount, totalTrackedEver)} IDs
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Room Capacity</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">
                    {Math.round((liveCount / Math.max(1, activeClassroom?.capacity || 90)) * 100)}% ({activeClassroom?.capacity || 90})
                  </span>
                </div>
              </div>

              {activeLecture && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200">{activeLecture.subjectCode}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">{activeLecture.status}</span>
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
              <span className="text-[10px] font-mono text-slate-400">
                {roi.width}% × {roi.height}%
              </span>
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
                  onChange={(e) => setRoi((prev) => ({ ...prev, width: parseInt(e.target.value, 10) }))}
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
                  onChange={(e) => setRoi((prev) => ({ ...prev, height: parseInt(e.target.value, 10) }))}
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
                title={`Proxy status: ${backendStatus.online ? 'Online' : 'Offline'}`}
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
