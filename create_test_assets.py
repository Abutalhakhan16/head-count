import os
import cv2
import numpy as np
import shutil

TEST_DIR = os.path.abspath("test_files")
FRONTEND_PUBLIC_TEST_DIR = os.path.abspath("frontend/public/test_files")
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(FRONTEND_PUBLIC_TEST_DIR, exist_ok=True)

print(f"Generating test files in {TEST_DIR} and {FRONTEND_PUBLIC_TEST_DIR}...")

# 1. Generate Classroom Lecture Test Video
def create_classroom_video():
    width, height = 1280, 720
    fps = 24.0
    total_frames = 120 # 5 seconds
    vid_path = os.path.join(TEST_DIR, "classroom_lecture.mp4")
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(vid_path, fourcc, fps, (width, height))
    
    # 20 Students distributed in rows
    np.random.seed(42)
    students = []
    rows = 4
    cols = 5
    for r in range(rows):
        for c in range(cols):
            bx = int(220 + c * 180 + (r % 2) * 20)
            by = int(260 + r * 105)
            students.append({
                "x": bx,
                "y": by,
                "speed": np.random.uniform(0.04, 0.08),
                "phase": np.random.uniform(0, np.pi * 2),
                "skin": (
                    int(np.random.randint(160, 220)),
                    int(np.random.randint(180, 230)),
                    int(np.random.randint(220, 255))
                ),
                "shirt": (
                    int(np.random.randint(50, 200)),
                    int(np.random.randint(50, 180)),
                    int(np.random.randint(150, 240))
                )
            })

    for f_idx in range(total_frames):
        # Create classroom background
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        # Background wall & floor
        frame[:350] = (30, 36, 45) # Wall
        frame[350:] = (45, 50, 60) # Floor
        
        # Blackboard
        cv2.rectangle(frame, (180, 40), (1100, 180), (40, 70, 45), -1)
        cv2.rectangle(frame, (180, 40), (1100, 180), (100, 120, 100), 4)
        cv2.putText(frame, "CCTV Vision & Head Counting System - Benchmark Test", (220, 115),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, (230, 240, 230), 2)
        cv2.putText(frame, "Sample Test Clip: Lecture Room 101 (20 Seated Students)", (220, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 220, 180), 2)

        # Draw desk rows
        for r in range(rows):
            dy = 240 + r * 105
            cv2.rectangle(frame, (120, dy + 45), (1160, dy + 70), (110, 120, 130), -1)
            cv2.rectangle(frame, (120, dy + 45), (1160, dy + 70), (80, 90, 100), 2)

        # Draw students with animated subtle head movements
        for s in students:
            wobble_x = int(np.sin(f_idx * s["speed"] + s["phase"]) * 4)
            wobble_y = int(np.cos(f_idx * (s["speed"] * 0.8) + s["phase"]) * 2)
            
            cx = s["x"] + wobble_x
            cy = s["y"] + wobble_y
            
            # Shoulders / Body
            cv2.ellipse(frame, (cx, cy + 42), (38, 26), 0, 0, 180, s["shirt"], -1)
            # Neck
            cv2.rectangle(frame, (cx - 8, cy + 14), (cx + 8, cy + 26), s["skin"], -1)
            # Head (face)
            cv2.circle(frame, (cx, cy), 22, s["skin"], -1)
            # Hair
            cv2.ellipse(frame, (cx, cy - 8), (22, 14), 0, 180, 360, (25, 25, 25), -1)
            # Eyes
            cv2.circle(frame, (cx - 7, cy - 1), 3, (40, 40, 40), -1)
            cv2.circle(frame, (cx + 7, cy - 1), 3, (40, 40, 40), -1)

        out.write(frame)

    out.release()
    print("Created:", vid_path)
    shutil.copy(vid_path, os.path.join(FRONTEND_PUBLIC_TEST_DIR, "classroom_lecture.mp4"))

# 2. Generate Single Student Close-up Test Video
def create_single_student_video():
    width, height = 1280, 720
    fps = 24.0
    total_frames = 96 # 4 seconds
    vid_path = os.path.join(TEST_DIR, "student_webcam_test.mp4")
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(vid_path, fourcc, fps, (width, height))
    
    for f in range(total_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (35, 40, 50)
        
        # Classroom office background
        cv2.rectangle(frame, (100, 80), (1180, 680), (45, 52, 65), -1)
        
        cx = int(640 + np.sin(f * 0.06) * 20)
        cy = int(380 + np.cos(f * 0.05) * 10)
        
        # Body
        cv2.ellipse(frame, (cx, cy + 180), (160, 120), 0, 0, 180, (50, 120, 200), -1)
        # Neck
        cv2.rectangle(frame, (cx - 30, cy + 70), (cx + 30, cy + 120), (180, 200, 230), -1)
        # Head
        cv2.circle(frame, (cx, cy), 90, (180, 200, 230), -1)
        # Hair
        cv2.ellipse(frame, (cx, cy - 35), (92, 55), 0, 180, 360, (30, 25, 20), -1)
        # Eyes
        cv2.circle(frame, (cx - 32, cy - 5), 10, (40, 40, 40), -1)
        cv2.circle(frame, (cx + 32, cy - 5), 10, (40, 40, 40), -1)
        # Smile
        cv2.ellipse(frame, (cx, cy + 35), (28, 16), 0, 0, 180, (40, 40, 40), 4)
        
        out.write(frame)

    out.release()
    print("Created:", vid_path)
    shutil.copy(vid_path, os.path.join(FRONTEND_PUBLIC_TEST_DIR, "student_webcam_test.mp4"))

# 3. Create Sample Test Images
def create_test_images():
    # Photographic sample images from Ultralytics
    import ultralytics
    u_dir = os.path.dirname(ultralytics.__file__)
    assets_dir = os.path.join(u_dir, "assets")
    
    zidane_src = os.path.join(assets_dir, "zidane.jpg")
    bus_src = os.path.join(assets_dir, "bus.jpg")
    
    if os.path.exists(zidane_src):
        shutil.copy(zidane_src, os.path.join(TEST_DIR, "people_heads_sample.jpg"))
        shutil.copy(zidane_src, os.path.join(FRONTEND_PUBLIC_TEST_DIR, "people_heads_sample.jpg"))
        print("Copied people_heads_sample.jpg")

    if os.path.exists(bus_src):
        shutil.copy(bus_src, os.path.join(TEST_DIR, "crowd_group_sample.jpg"))
        shutil.copy(bus_src, os.path.join(FRONTEND_PUBLIC_TEST_DIR, "crowd_group_sample.jpg"))
        print("Copied crowd_group_sample.jpg")

create_classroom_video()
create_single_student_video()
create_test_images()

print("All test assets created successfully!")
