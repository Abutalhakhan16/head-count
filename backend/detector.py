"""
AI Head & Person Detector for Classroom & Camera Vision
Detects visible people and heads using YOLOv8 and OpenCV Haar Cascades,
with real-time head localization, ROI filtering, and robust tracking support.
"""

import os
import cv2
import numpy as np
from typing import List, Tuple, Dict, Any, Optional

class PersonDetector:
    def __init__(self, model_name: str = "yolov8n.pt", confidence: float = 0.40):
        self.model_name = model_name
        self.confidence = confidence
        self.yolo_model = None
        self.backend_type = "SIMULATED"
        self.face_cascade = None
        self.profile_cascade = None
        self._initialize_model()
        self._initialize_cascades()

    def _initialize_model(self):
        try:
            from ultralytics import YOLO
            local_weights = os.path.join(os.path.dirname(__file__), self.model_name)
            target_model = local_weights if os.path.exists(local_weights) else self.model_name
            self.yolo_model = YOLO(target_model)
            self.backend_type = "ULTRALYTICS_YOLOV8"
            print(f"[Detector] Successfully loaded {target_model}")
        except Exception as e:
            print(f"[Detector] Ultralytics YOLOv8 not available ({e}). Using OpenCV person detection fallback.")
            self.backend_type = "OPENCV_FALLBACK"

    def _initialize_cascades(self):
        try:
            frontal_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            profile_path = cv2.data.haarcascades + "haarcascade_profileface.xml"
            if os.path.exists(frontal_path):
                self.face_cascade = cv2.CascadeClassifier(frontal_path)
            if os.path.exists(profile_path):
                self.profile_cascade = cv2.CascadeClassifier(profile_path)
            print("[Detector] Loaded OpenCV Face/Head Haar Cascades successfully")
        except Exception as e:
            print(f"[Detector] Could not load Haar cascades: {e}")

    def detect_heads_and_persons(
        self,
        frame_bgr: np.ndarray,
        target_mode: str = "head",
        confidence: Optional[float] = None,
        roi: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Detects heads and/or persons in the given OpenCV BGR frame.
        target_mode: 'head' | 'person' | 'both'
        roi: Optional {'x': %, 'y': %, 'width': %, 'height': %}
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return []

        h, w = frame_bgr.shape[:2]
        conf_thresh = confidence if confidence is not None else self.confidence
        person_detections = []

        # 1. Detect Persons using YOLOv8 or HOG Fallback
        if self.backend_type == "ULTRALYTICS_YOLOV8" and self.yolo_model is not None:
            results = self.yolo_model(frame_bgr, classes=[0], conf=conf_thresh, verbose=False)
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    if cls_id == 0:
                        x1 = max(0, min(int(x1), w - 1))
                        y1 = max(0, min(int(y1), h - 1))
                        x2 = max(0, min(int(x2), w))
                        y2 = max(0, min(int(y2), h))
                        if x2 > x1 and y2 > y1:
                            person_detections.append({
                                "bbox": (x1, y1, x2, y2),
                                "confidence": round(conf, 3),
                                "class_name": "person"
                            })
        else:
            # OpenCV HOG Fallback for person detection
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            boxes, weights = hog.detectMultiScale(frame_bgr, winStride=(8, 8), padding=(4, 4), scale=1.05)
            for (x, y, bw, bh), weight in zip(boxes, weights):
                if float(weight) >= conf_thresh:
                    person_detections.append({
                        "bbox": (int(x), int(y), int(x + bw), int(y + bh)),
                        "confidence": round(float(weight), 3),
                        "class_name": "person"
                    })

        # 2. Run Haar Face/Head cascades for direct head detection
        face_boxes = []
        try:
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            # Apply histogram equalization for robust lighting invariance
            gray = cv2.equalizeHist(gray)

            if self.face_cascade and not self.face_cascade.empty():
                faces = self.face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.12,
                    minNeighbors=4,
                    minSize=(24, 24),
                    flags=cv2.CASCADE_SCALE_IMAGE
                )
                for (fx, fy, fw, fh) in faces:
                    face_boxes.append((int(fx), int(fy), int(fx + fw), int(fy + fh), 0.92))

            if self.profile_cascade and not self.profile_cascade.empty():
                profiles = self.profile_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.15,
                    minNeighbors=4,
                    minSize=(24, 24)
                )
                for (px, py, pw_box, ph_box) in profiles:
                    face_boxes.append((int(px), int(py), int(px + pw_box), int(py + ph_box), 0.88))
        except Exception as e:
            print(f"[Detector] Face detection warning: {e}")

        # 3. Associate Heads with Persons & Synthesize missing Head / Person boxes
        matched_face_indices = set()
        final_results = []

        for p_idx, p in enumerate(person_detections):
            px1, py1, px2, py2 = p["bbox"]
            pw = px2 - px1
            ph = py2 - py1

            # Estimate default head box in upper 35% of person body
            head_w = int(pw * 0.52)
            head_h = int(min(ph * 0.35, pw * 0.85))
            hx1 = max(0, px1 + int(pw * 0.24))
            hy1 = max(0, py1)
            hx2 = min(w, hx1 + head_w)
            hy2 = min(h, py1 + head_h)
            head_box = (hx1, hy1, hx2, hy2)
            head_conf = p["confidence"]

            # Check if any detected face aligns with this person's upper region
            for f_idx, (fx1, fy1, fx2, fy2, f_conf) in enumerate(face_boxes):
                if f_idx in matched_face_indices:
                    continue
                # Center of face inside person upper body
                fcx = (fx1 + fx2) / 2.0
                fcy = (fy1 + fy2) / 2.0
                if px1 - 10 <= fcx <= px2 + 10 and py1 - 10 <= fcy <= py1 + ph * 0.55:
                    head_box = (fx1, fy1, fx2, fy2)
                    head_conf = max(head_conf, f_conf)
                    matched_face_indices.add(f_idx)
                    break

            # Check ROI filter
            in_roi = True
            if roi:
                # Use head center for ROI test
                hc = ((head_box[0] + head_box[2]) / 2.0, (head_box[1] + head_box[3]) / 2.0)
                in_roi = self._point_in_roi(hc, roi, (h, w))

            # Select output box based on target_mode
            if target_mode == "head":
                active_box = head_box
                cls_name = "head"
            elif target_mode == "person":
                active_box = p["bbox"]
                cls_name = "person"
            else: # "both"
                active_box = head_box
                cls_name = "head"

            final_results.append({
                "bbox": active_box,
                "head_bbox": head_box,
                "person_bbox": p["bbox"],
                "confidence": round(head_conf, 3),
                "class_name": cls_name,
                "in_roi": in_roi
            })

        # 4. Add standalone face/head detections (e.g. close-up webcam view without full body)
        for f_idx, (fx1, fy1, fx2, fy2, f_conf) in enumerate(face_boxes):
            if f_idx in matched_face_indices:
                continue
            
            # Avoid duplicate overlapping face boxes
            overlap = False
            for existing in final_results:
                ehx1, ehy1, ehx2, ehy2 = existing["head_bbox"]
                # IoU check
                ix1 = max(fx1, ehx1)
                iy1 = max(fy1, ehy1)
                ix2 = min(fx2, ehx2)
                iy2 = min(fy2, ehy2)
                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    box_area = (fx2 - fx1) * (fy2 - fy1)
                    if inter_area / max(1, box_area) > 0.35:
                        overlap = True
                        break
            if overlap:
                continue

            # Estimate surrounding person box from face
            fw = fx2 - fx1
            fh = fy2 - fy1
            est_px1 = max(0, fx1 - int(fw * 0.6))
            est_py1 = max(0, fy1)
            est_px2 = min(w, fx2 + int(fw * 0.6))
            est_py2 = min(h, fy1 + int(fh * 3.5))

            in_roi = True
            if roi:
                hc = ((fx1 + fx2) / 2.0, (fy1 + fy2) / 2.0)
                in_roi = self._point_in_roi(hc, roi, (h, w))

            head_box = (fx1, fy1, fx2, fy2)
            person_box = (est_px1, est_py1, est_px2, est_py2)
            active_box = head_box if target_mode in ("head", "both") else person_box

            final_results.append({
                "bbox": active_box,
                "head_bbox": head_box,
                "person_bbox": person_box,
                "confidence": round(f_conf, 3),
                "class_name": "head",
                "in_roi": in_roi
            })

        return final_results

    def detect(self, frame_bgr) -> List[Dict[str, Any]]:
        """
        Legacy interface for backwards compatibility.
        """
        return self.detect_heads_and_persons(frame_bgr, target_mode="head")

    def _point_in_roi(self, pt: Tuple[float, float], roi: Dict[str, float], frame_shape: Tuple[int, int]) -> bool:
        h, w = frame_shape[:2]
        cx, cy = pt
        rx = (roi.get("x", 0) / 100.0) * w
        ry = (roi.get("y", 0) / 100.0) * h
        rw = (roi.get("width", 100) / 100.0) * w
        rh = (roi.get("height", 100) / 100.0) * h
        return rx <= cx <= (rx + rw) and ry <= cy <= (ry + rh)

    def is_inside_roi(self, bbox: Tuple[int, int, int, int], roi: Dict[str, float], frame_shape: Tuple[int, int]) -> bool:
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        return self._point_in_roi((cx, cy), roi, frame_shape)
