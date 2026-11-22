"""
Object Tracker for Smart Classroom Analytics & Head Count
Maintains persistent track IDs for heads/people across consecutive video frames
to prevent duplicate counting, handle brief occlusions, and stabilize headcount.
"""

import math
from typing import Dict, List, Tuple

class TrackedPerson:
    def __init__(self, track_id: int, centroid: Tuple[int, int], bbox: Tuple[int, int, int, int], label: str = "head"):
        self.track_id = track_id
        self.centroid = centroid
        self.bbox = bbox  # (x1, y1, x2, y2)
        self.label = label
        self.disappeared_frames = 0
        self.counted = False
        self.history: List[Tuple[int, int]] = [centroid]

    def update(self, centroid: Tuple[int, int], bbox: Tuple[int, int, int, int]):
        self.centroid = centroid
        self.bbox = bbox
        self.disappeared_frames = 0
        self.history.append(centroid)
        if len(self.history) > 30:
            self.history.pop(0)

class PersonTracker:
    def __init__(self, max_disappeared: int = 25, max_distance: float = 120.0):
        self.next_track_id = 1
        self.tracks: Dict[int, TrackedPerson] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        self.cumulative_unique_counted = 0

    def calculate_centroid(self, bbox: Tuple[int, int, int, int]) -> Tuple[int, int]:
        x1, y1, x2, y2 = bbox
        return (int((x1 + x2) / 2.0), int((y1 + y2) / 2.0))

    def update(self, detections: List[Tuple[int, int, int, int]], labels: List[str] = None) -> Dict[int, TrackedPerson]:
        """
        detections: list of bounding boxes (x1, y1, x2, y2)
        """
        if labels is None:
            labels = ["head"] * len(detections)

        if len(detections) == 0:
            for track_id in list(self.tracks.keys()):
                self.tracks[track_id].disappeared_frames += 1
                if self.tracks[track_id].disappeared_frames > self.max_disappeared:
                    del self.tracks[track_id]
            return self.tracks

        input_centroids = [self.calculate_centroid(box) for box in detections]

        if len(self.tracks) == 0:
            for i, box in enumerate(detections):
                lbl = labels[i] if i < len(labels) else "head"
                track = TrackedPerson(self.next_track_id, input_centroids[i], box, label=lbl)
                self.tracks[self.next_track_id] = track
                self.cumulative_unique_counted += 1
                self.next_track_id += 1
            return self.tracks

        # Associate existing tracks with new detections using Euclidean distance
        track_ids = list(self.tracks.keys())
        track_centroids = [self.tracks[tid].centroid for tid in track_ids]

        # Compute distance matrix
        matched_detections = set()
        matched_tracks = set()

        for t_idx, tid in enumerate(track_ids):
            tc = track_centroids[t_idx]
            best_dist = float('inf')
            best_det_idx = -1

            for d_idx, dc in enumerate(input_centroids):
                if d_idx in matched_detections:
                    continue
                dist = math.hypot(tc[0] - dc[0], tc[1] - dc[1])
                if dist < best_dist and dist < self.max_distance:
                    best_dist = dist
                    best_det_idx = d_idx

            if best_det_idx != -1:
                self.tracks[tid].update(input_centroids[best_det_idx], detections[best_det_idx])
                matched_detections.add(best_det_idx)
                matched_tracks.add(tid)
            else:
                self.tracks[tid].disappeared_frames += 1
                if self.tracks[tid].disappeared_frames > self.max_disappeared:
                    del self.tracks[tid]

        # Add new detections as new tracks
        for d_idx, box in enumerate(detections):
            if d_idx not in matched_detections:
                lbl = labels[d_idx] if d_idx < len(labels) else "head"
                track = TrackedPerson(self.next_track_id, input_centroids[d_idx], box, label=lbl)
                self.tracks[self.next_track_id] = track
                self.cumulative_unique_counted += 1
                self.next_track_id += 1

        return self.tracks
