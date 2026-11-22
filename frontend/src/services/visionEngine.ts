import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as blazeface from '@tensorflow-models/blazeface';
import { DetectionBoxData, DetectionResult } from '../services/aiBackendService';

interface TrackEntry {
  id: number;
  centroid: [number, number];
  bbox: [number, number, number, number];
  disappeared: number;
}

/**
 * Identity-free centroid tracker ported from backend/tracker.py.
 * Assigns persistent track IDs across consecutive video/camera frames.
 */
class CentroidTracker {
  private nextObjectId = 1;
  private tracks = new Map<number, TrackEntry>();
  private maxDisappeared: number;
  private maxDistance: number;
  public cumulativeUniqueCounted = 0;

  constructor(maxDisappeared = 12, maxDistance = 95) {
    this.maxDisappeared = maxDisappeared;
    this.maxDistance = maxDistance;
  }

  reset(): void {
    this.nextObjectId = 1;
    this.tracks.clear();
    this.cumulativeUniqueCounted = 0;
  }

  update(bboxes: Array<[number, number, number, number]>): number[] {
    if (bboxes.length === 0) {
      for (const [id, track] of this.tracks.entries()) {
        track.disappeared += 1;
        if (track.disappeared > this.maxDisappeared) {
          this.tracks.delete(id);
        }
      }
      return [];
    }

    const inputCentroids: Array<[number, number]> = bboxes.map(([x, y, w, h]) => [
      x + w / 2,
      y + h / 2,
    ]);

    if (this.tracks.size === 0) {
      return bboxes.map((bbox, i) => {
        const id = this.nextObjectId++;
        this.cumulativeUniqueCounted += 1;
        this.tracks.set(id, {
          id,
          centroid: inputCentroids[i],
          bbox,
          disappeared: 0,
        });
        return id;
      });
    }

    const trackIds = Array.from(this.tracks.keys());
    const usedTrackIds = new Set<number>();
    const assignedIds = new Array<number>(bboxes.length).fill(-1);

    // Greedy nearest-centroid assignment sorted by shortest distance
    const pairs: Array<{ tIdx: number; dIdx: number; dist: number }> = [];
    for (let tIdx = 0; tIdx < trackIds.length; tIdx++) {
      const track = this.tracks.get(trackIds[tIdx])!;
      for (let dIdx = 0; dIdx < inputCentroids.length; dIdx++) {
        const dx = track.centroid[0] - inputCentroids[dIdx][0];
        const dy = track.centroid[1] - inputCentroids[dIdx][1];
        const dist = Math.hypot(dx, dy);
        if (dist <= this.maxDistance) {
          pairs.push({ tIdx, dIdx, dist });
        }
      }
    }

    pairs.sort((a, b) => a.dist - b.dist);
    const matchedDetections = new Set<number>();

    for (const pair of pairs) {
      const tid = trackIds[pair.tIdx];
      if (usedTrackIds.has(tid) || matchedDetections.has(pair.dIdx)) continue;
      usedTrackIds.add(tid);
      matchedDetections.add(pair.dIdx);
      assignedIds[pair.dIdx] = tid;
      this.tracks.set(tid, {
        id: tid,
        centroid: inputCentroids[pair.dIdx],
        bbox: bboxes[pair.dIdx],
        disappeared: 0,
      });
    }

    for (const tid of trackIds) {
      if (!usedTrackIds.has(tid)) {
        const t = this.tracks.get(tid)!;
        t.disappeared += 1;
        if (t.disappeared > this.maxDisappeared) {
          this.tracks.delete(tid);
        }
      }
    }

    for (let dIdx = 0; dIdx < bboxes.length; dIdx++) {
      if (assignedIds[dIdx] === -1) {
        const id = this.nextObjectId++;
        this.cumulativeUniqueCounted += 1;
        this.tracks.set(id, {
          id,
          centroid: inputCentroids[dIdx],
          bbox: bboxes[dIdx],
          disappeared: 0,
        });
        assignedIds[dIdx] = id;
      }
    }

    return assignedIds;
  }
}

export interface VideoAnalysisReport {
  durationSeconds: number;
  samplesAnalyzed: number;
  averageAttendance: number;
  peakAttendance: number;
  lowestAttendance: number;
  uniqueStudentsTracked: number;
  samples: Array<{
    timestampSec: number;
    count: number;
    headCount: number;
    personCount: number;
  }>;
}

class VisionEngine {
  private cocoModel: cocoSsd.ObjectDetection | null = null;
  private faceModel: blazeface.BlazeFaceModel | null = null;
  private loadingPromise: Promise<void> | null = null;
  private loadError: string | null = null;
  private tracker = new CentroidTracker(12, 110);

  public isReady(): boolean {
    return Boolean(this.cocoModel && this.faceModel);
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  public resetTracker(): void {
    this.tracker.reset();
  }

  public async ensureLoaded(): Promise<boolean> {
    if (this.cocoModel && this.faceModel) return true;
    if (this.loadingPromise) {
      await this.loadingPromise;
      return Boolean(this.cocoModel && this.faceModel);
    }

    this.loadingPromise = (async () => {
      try {
        this.loadError = null;
        await tf.ready();
        const [coco, face] = await Promise.all([
          cocoSsd.load({ base: 'lite_mobilenet_v2' }),
          blazeface.load(),
        ]);
        this.cocoModel = coco;
        this.faceModel = face;
      } catch (err: any) {
        this.loadError = err?.message || 'Failed to load AI vision models';
        console.warn('[VisionEngine] Model load warning:', err);
      } finally {
        this.loadingPromise = null;
      }
    })();

    await this.loadingPromise;
    return Boolean(this.cocoModel && this.faceModel);
  }

  private pointInRoi(
    cx: number,
    cy: number,
    roi: { x: number; y: number; width: number; height: number },
    frameW: number,
    frameH: number
  ): boolean {
    const rx = (roi.x / 100) * frameW;
    const ry = (roi.y / 100) * frameH;
    const rw = (roi.width / 100) * frameW;
    const rh = (roi.height / 100) * frameH;
    return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
  }

  private iou(
    a: [number, number, number, number],
    b: [number, number, number, number]
  ): number {
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
    const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    if (x2 <= x1 || y2 <= y1) return 0;
    const inter = (x2 - x1) * (y2 - y1);
    const union = a[2] * a[3] + b[2] * b[3] - inter;
    return union > 0 ? inter / union : 0;
  }

  /**
   * Detects people (COCO-SSD) and faces/heads (BlazeFace),
   * merges them just like backend/detector.py, tracks IDs, and filters by ROI.
   */
  public async detectFrame(
    input: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
    options: {
      mode: 'head' | 'person' | 'both';
      confidence: number;
      roi: { x: number; y: number; width: number; height: number };
      frameWidth: number;
      frameHeight: number;
    }
  ): Promise<DetectionResult> {
    const start = performance.now();
    const ready = await this.ensureLoaded();
    const { mode, confidence, roi, frameWidth, frameHeight } = options;

    if (!ready || !this.cocoModel || !this.faceModel) {
      return {
        count: 0,
        head_count: 0,
        person_count: 0,
        total_unique_tracked: this.tracker.cumulativeUniqueCounted,
        boxes: [],
        processing_time_ms: Math.round(performance.now() - start),
        fps: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const minCocoScore = Math.max(0.15, confidence);
    const [cocoPreds, facePreds] = await Promise.all([
      this.cocoModel.detect(input, 30, minCocoScore),
      this.faceModel.estimateFaces(input, false),
    ]);

    const persons = cocoPreds
      .filter((p) => p.class === 'person' && p.score >= confidence)
      .map((p) => ({
        bbox: [
          Math.max(0, Math.round(p.bbox[0])),
          Math.max(0, Math.round(p.bbox[1])),
          Math.round(p.bbox[2]),
          Math.round(p.bbox[3]),
        ] as [number, number, number, number],
        score: p.score,
      }));

    const faces = (facePreds || [])
      .map((f: any) => {
        const [x1, y1] = f.topLeft as [number, number];
        const [x2, y2] = f.bottomRight as [number, number];
        const prob = Array.isArray(f.probability)
          ? Number(f.probability[0])
          : Number(f.probability ?? 0.9);
        return {
          bbox: [
            Math.max(0, Math.round(x1)),
            Math.max(0, Math.round(y1)),
            Math.max(12, Math.round(x2 - x1)),
            Math.max(12, Math.round(y2 - y1)),
          ] as [number, number, number, number],
          score: prob,
        };
      })
      .filter((f) => f.score >= Math.max(0.45, confidence));

    const matchedFaces = new Set<number>();
    const rawDetections: Array<{
      activeBox: [number, number, number, number];
      headBox: [number, number, number, number];
      personBox: [number, number, number, number];
      confidence: number;
      className: 'head' | 'person';
      inRoi: boolean;
    }> = [];

    for (const p of persons) {
      const [px, py, pw, ph] = p.bbox;
      // Default head estimate in upper-center region of detected person
      const estHeadW = Math.max(18, Math.round(pw * 0.45));
      const estHeadH = Math.max(18, Math.round(Math.min(ph * 0.28, pw * 0.7)));
      let headBox: [number, number, number, number] = [
        Math.max(0, px + Math.round((pw - estHeadW) / 2)),
        Math.max(0, py),
        estHeadW,
        estHeadH,
      ];
      let headConf = p.score;

      // Refine head box if BlazeFace detected a face in upper 55% of person box
      for (let fi = 0; fi < faces.length; fi++) {
        if (matchedFaces.has(fi)) continue;
        const f = faces[fi];
        const fcx = f.bbox[0] + f.bbox[2] / 2;
        const fcy = f.bbox[1] + f.bbox[3] / 2;
        if (fcx >= px - 12 && fcx <= px + pw + 12 && fcy >= py - 12 && fcy <= py + ph * 0.55) {
          headBox = f.bbox;
          headConf = Math.max(headConf, f.score);
          matchedFaces.add(fi);
          break;
        }
      }

      const hcx = headBox[0] + headBox[2] / 2;
      const hcy = headBox[1] + headBox[3] / 2;
      const inRoi = this.pointInRoi(hcx, hcy, roi, frameWidth, frameHeight);
      const className: 'head' | 'person' = mode === 'person' ? 'person' : 'head';
      const activeBox = mode === 'person' ? p.bbox : headBox;

      rawDetections.push({
        activeBox,
        headBox,
        personBox: p.bbox,
        confidence: Number(headConf.toFixed(3)),
        className,
        inRoi,
      });
    }

    // Add standalone close-up face detections not matched to a full person box
    for (let fi = 0; fi < faces.length; fi++) {
      if (matchedFaces.has(fi)) continue;
      const f = faces[fi];
      const overlaps = rawDetections.some((d) => this.iou(f.bbox, d.headBox) > 0.35);
      if (overlaps) continue;

      const [fx, fy, fw, fh] = f.bbox;
      const estPersonBox: [number, number, number, number] = [
        Math.max(0, fx - Math.round(fw * 0.6)),
        Math.max(0, fy),
        Math.min(frameWidth, Math.round(fw * 2.2)),
        Math.min(frameHeight, Math.round(fh * 3.5)),
      ];
      const fcx = fx + fw / 2;
      const fcy = fy + fh / 2;
      const inRoi = this.pointInRoi(fcx, fcy, roi, frameWidth, frameHeight);
      const className: 'head' | 'person' = mode === 'person' ? 'person' : 'head';
      const activeBox = mode === 'person' ? estPersonBox : f.bbox;

      rawDetections.push({
        activeBox,
        headBox: f.bbox,
        personBox: estPersonBox,
        confidence: Number(f.score.toFixed(3)),
        className,
        inRoi,
      });
    }

    const roiBoxes = rawDetections.filter((d) => d.inRoi).map((d) => d.activeBox);
    const assignedTrackIds = this.tracker.update(roiBoxes);

    let roiIdx = 0;
    const boxes: DetectionBoxData[] = rawDetections.map((d, idx) => {
      const tid = d.inRoi ? assignedTrackIds[roiIdx++] : idx + 1;
      return {
        track_id: tid,
        x: d.activeBox[0],
        y: d.activeBox[1],
        width: d.activeBox[2],
        height: d.activeBox[3],
        confidence: d.confidence,
        class_name: d.className,
        label:
          mode === 'both'
            ? `Head+Body #${tid}`
            : d.className === 'head'
            ? `Head #${tid}`
            : `Person #${tid}`,
        in_roi: d.inRoi,
        head_box: {
          x: d.headBox[0],
          y: d.headBox[1],
          width: d.headBox[2],
          height: d.headBox[3],
        },
        person_box: {
          x: d.personBox[0],
          y: d.personBox[1],
          width: d.personBox[2],
          height: d.personBox[3],
        },
      };
    });

    const inRoiBoxes = boxes.filter((b) => b.in_roi);
    const durationMs = Math.max(1, Math.round(performance.now() - start));

    return {
      count: inRoiBoxes.length,
      head_count: inRoiBoxes.length,
      person_count: persons.filter((p) =>
        this.pointInRoi(
          p.bbox[0] + p.bbox[2] / 2,
          p.bbox[1] + p.bbox[3] / 2,
          roi,
          frameWidth,
          frameHeight
        )
      ).length,
      total_unique_tracked: this.tracker.cumulativeUniqueCounted,
      boxes,
      processing_time_ms: durationMs,
      fps: Number((1000 / durationMs).toFixed(1)),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch-analyzes a video file/URL across sampled frames for attendance metrics.
   */
  public async analyzeVideoSource(
    videoUrl: string,
    options: {
      mode: 'head' | 'person' | 'both';
      confidence: number;
      roi: { x: number; y: number; width: number; height: number };
      onProgress?: (pct: number) => void;
    }
  ): Promise<VideoAnalysisReport> {
    await this.ensureLoaded();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not decode video file metadata'));
    });

    const duration = Math.max(0.5, video.duration || 5);
    const sampleCount = Math.min(12, Math.max(5, Math.ceil(duration * 2)));
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const batchTracker = new CentroidTracker(8, 100);
    const prevTracker = this.tracker;
    this.tracker = batchTracker;

    const samples: VideoAnalysisReport['samples'] = [];

    try {
      for (let i = 0; i < sampleCount; i++) {
        const ts = Math.min(duration - 0.05, (i / Math.max(1, sampleCount - 1)) * (duration - 0.1));
        video.currentTime = Math.max(0, ts);
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const res = await this.detectFrame(canvas, {
          mode: options.mode,
          confidence: options.confidence,
          roi: options.roi,
          frameWidth: canvas.width,
          frameHeight: canvas.height,
        });

        samples.push({
          timestampSec: Number(ts.toFixed(1)),
          count: res.count,
          headCount: res.head_count ?? res.count,
          personCount: res.person_count ?? res.count,
        });

        if (options.onProgress) {
          options.onProgress(Math.round(((i + 1) / sampleCount) * 100));
        }
      }
    } finally {
      this.tracker = prevTracker;
      video.src = '';
    }

    const counts = samples.map((s) => s.count);
    const avg = counts.length > 0 ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0;
    const peak = counts.length > 0 ? Math.max(...counts) : 0;
    const low = counts.length > 0 ? Math.min(...counts) : 0;

    return {
      durationSeconds: Number(duration.toFixed(1)),
      samplesAnalyzed: samples.length,
      averageAttendance: avg,
      peakAttendance: peak,
      lowestAttendance: low,
      uniqueStudentsTracked: Math.max(peak, batchTracker.cumulativeUniqueCounted),
      samples,
    };
  }
}

export const visionEngine = new VisionEngine();
