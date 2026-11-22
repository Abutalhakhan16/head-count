export interface BackendStatus {
  online: boolean;
  version?: string;
  device?: string;
  model?: string;
  fps?: number;
  activeStreams?: number;
  message?: string;
  features?: {
    head_counting?: boolean;
    webcam_support?: boolean;
    cctv_rtsp_support?: boolean;
    roi_filter?: boolean;
  };
}

export interface DetectionBoxData {
  track_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class_name?: string;
  label?: string;
  in_roi?: boolean;
  head_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  person_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectionResult {
  count: number;
  head_count?: number;
  person_count?: number;
  total_unique_tracked?: number;
  boxes: DetectionBoxData[];
  processing_time_ms: number;
  fps?: number;
  timestamp: string;
}

const BACKEND_BASE_URL = 'http://localhost:8000';

export const aiBackendService = {
  baseUrl: BACKEND_BASE_URL,

  async checkStatus(): Promise<BackendStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Status error');
      const data = await res.json();
      return {
        online: true,
        version: data.version || '2.6.0',
        device: data.device || 'CPU / Apple Silicon Metal MPS',
        model: data.model || 'YOLOv8n + Haar Cascades Head Detection',
        fps: data.fps || 30,
        activeStreams: data.active_streams || 1,
        message: 'Connected to Python FastAPI & YOLOv8 + Head Vision Engine',
        features: data.features || { head_counting: true, webcam_support: true, cctv_rtsp_support: true, roi_filter: true },
      };
    } catch {
      return {
        online: false,
        message: 'Python Backend Offline (Using In-Browser Head Detection & Stream)',
      };
    }
  },

  async testCctvConnection(rtspUrl: string): Promise<{ online: boolean; message: string; resolution?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/api/test-cctv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp_url: rtspUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Network error testing CCTV');
      return await res.json();
    } catch (e: any) {
      return {
        online: false,
        message: `Connection check failed: ${e.message || 'Make sure backend is running'}`,
      };
    }
  },

  async registerCamera(cameraData: {
    id?: string;
    name: string;
    rtsp_url: string;
    classroom?: string;
    fps?: number;
  }): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to register camera to backend:', e);
      return null;
    }
  },

  async processFrame(
    blob: Blob,
    options?: {
      mode?: 'head' | 'person' | 'both';
      confidence?: number;
      roi?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<DetectionResult | null> {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('mode', options?.mode || 'head');
      if (options?.confidence !== undefined) {
        formData.append('confidence', options.confidence.toString());
      }
      if (options?.roi) {
        formData.append('roi_x', options.roi.x.toString());
        formData.append('roi_y', options.roi.y.toString());
        formData.append('roi_width', options.roi.width.toString());
        formData.append('roi_height', options.roi.height.toString());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.baseUrl}/api/count-frame`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  async processVideoFile(file: File): Promise<any | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${this.baseUrl}/api/process-video`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to process video');
      return await res.json();
    } catch (e) {
      console.warn('Video upload processing error:', e);
      return null;
    }
  },

  getRtspStreamUrl(cameraId: string): string {
    return `${this.baseUrl}/api/stream/${cameraId}`;
  },

  getCustomCctvStreamUrl(url: string): string {
    return `${this.baseUrl}/api/cctv/stream?url=${encodeURIComponent(url)}`;
  },

  getWebcamStreamUrl(): string {
    return `${this.baseUrl}/api/webcam/stream`;
  }
};
