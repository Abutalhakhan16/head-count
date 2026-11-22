# Smart Classroom Analytics

An AI-powered institutional web application that leverages existing classroom CCTV cameras to automatically count students present during lectures, compare lecture-to-lecture attendance trends, and generate comprehensive occupancy analytics without biometric face identification.

---

## 🌟 Key Capabilities

### 1. Privacy-Preserving AI People Counting
- Utilizes **YOLOv8** bounding box person detection and **ByteTrack / Kalman motion filtering** to track students.
- **Zero Face Recognition**: Does not capture, process, or store facial biometrics or personal identity profiles.
- **Classroom Counting Region (ROI)**: Administrators can visually define the counting zone to exclude doors, walkways, podiums, and faculty desks.

### 2. Lecture-to-Lecture Comparison Engine
- Compares student attendance between the **Current Lecture** and:
  - Immediate **Previous Lecture** (Lecture $N$ vs. $N-1$)
  - **Previous Day** (Same time slot yesterday)
  - **Previous Week** (Same session 7 days prior)
  - **Same Weekday in Previous Weeks** (e.g. All Friday lectures)
  - **Custom Multi-Session Comparisons**
- Computes exact student headcount difference ($\pm \Delta$) and percentage changes ($\pm \%$).
- Visualizes attendance trajectories against historical course averages with interactive charts.

### 3. Dedicated CCTV Monitoring Interface
- Connects RTSP camera streams via IP CCTV endpoints (`rtsp://...`).
- Real-time video canvas with rendered bounding boxes, track IDs, and confidence levels.
- Video upload facility for local testing of recorded classroom clips.
- Seamless dual-mode execution: **Native Python FastAPI Backend** and **High-Fidelity Client CV Simulator**.

### 4. Role-Based Interfaces
- **Admin**: Full control over classrooms, RTSP camera endpoints, faculty assignments, and analytics.
- **Faculty**: Monitor assigned lectures, track live counts, and generate course reports.
- **Student**: View class-level attendance statistics and historical trends without access to camera feeds.

### 5. Institutional Analytics & PDF/CSV Export
- Real downloadable **CSV** and styled **PDF reports** with executive summaries and lecture matrices.
- Daily, Weekly, and Monthly attendance trends.
- Subject-wise and classroom-wise occupancy breakdowns.
- Peak campus lecture time block identification.

---

## 🚀 Quick Start Guide

### 1. Frontend Setup (React + Vite + Tailwind CSS)

```bash
cd frontend
npm install
npm run dev
```

The application will start at `http://localhost:3000`.

To create a production build:
```bash
npm run build
```

---

### 2. Python Backend Setup (FastAPI + OpenCV + YOLOv8)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The FastAPI server will be available at `http://localhost:8000` with Swagger API docs at `http://localhost:8000/docs`.

#### Backend API Endpoints:
- `GET /api/status`: Health check, active model, and device status.
- `GET /api/cameras`: Camera specifications and connection parameters.
- `POST /api/count-frame`: Detects people in a single uploaded image frame.
- `POST /api/process-video`: Samples and tracks people across a recorded classroom video clip.
- `GET /api/stream/{camera_id}`: Continuous MJPEG stream with YOLOv8 bounding boxes and ROI overlays.

---

## 🗄️ Database Architecture (Supabase PostgreSQL)

The database schema is provided in `backend/supabase_schema.sql`. You can execute it directly in the Supabase SQL Editor.

Tables:
- `classrooms`: Physical room capacities, floor, and building.
- `cctv_cameras`: RTSP connection URLs, IPs, resolutions, and ROI zones.
- `lectures`: Academic schedule, enrolled counts, present counts, and CCTV session linkages.
- `cctv_attendance_logs`: Time-series headcount logs and confidence metrics.

---

## 🌐 Deployment

### Frontend (Vercel)
1. Push repository to GitHub.
2. Import project into [Vercel](https://vercel.com).
3. Set the Root Directory to `frontend`.
4. Deploy with automatic build detection (`npm run build`).

### Backend (Render / Railway / GCP Cloud Run)
1. Set the Root Directory to `backend`.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
