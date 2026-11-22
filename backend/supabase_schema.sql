-- ==============================================================================
-- SMART CLASSROOM ANALYTICS: SUPABASE POSTGRESQL SCHEMA
-- Automated CCTV Headcount & Lecture Attendance Verification System
-- ==============================================================================

-- 1. Classrooms Table
CREATE TABLE IF NOT EXISTS public.classrooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    capacity INTEGER NOT NULL,
    camera_id TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'IDLE', 'MAINTENANCE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CCTV Cameras Table
CREATE TABLE IF NOT EXISTS public.cctv_cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE SET NULL,
    rtsp_url TEXT NOT NULL,
    ip_address INET,
    port INTEGER DEFAULT 554,
    status TEXT DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'CONNECTING')),
    resolution TEXT DEFAULT '1920x1080 (1080p)',
    fps INTEGER DEFAULT 30,
    bitrate TEXT DEFAULT '4.2 Mbps',
    latency_ms INTEGER DEFAULT 140,
    roi_zone JSONB DEFAULT '{"x": 5, "y": 15, "width": 90, "height": 80}'::jsonb,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Academic Lectures Table
CREATE TABLE IF NOT EXISTS public.lectures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE CASCADE,
    faculty_id TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    date DATE NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    enrolled_students INTEGER NOT NULL CHECK (enrolled_students > 0),
    present_students INTEGER DEFAULT 0 CHECK (present_students >= 0),
    peak_students INTEGER DEFAULT 0,
    average_occupancy_percent NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')),
    camera_id TEXT REFERENCES public.cctv_cameras(id) ON DELETE SET NULL,
    topic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CCTV Live Headcount Log Records
CREATE TABLE IF NOT EXISTS public.cctv_attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    lecture_id TEXT REFERENCES public.lectures(id) ON DELETE CASCADE,
    camera_id TEXT REFERENCES public.cctv_cameras(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    student_headcount INTEGER NOT NULL CHECK (student_headcount >= 0),
    tracked_person_ids JSONB,
    confidence_avg NUMERIC(4,3),
    in_roi_count INTEGER
);

-- 5. Indexes for fast lecture comparison queries
CREATE INDEX IF NOT EXISTS idx_lectures_subject_date ON public.lectures (subject_code, date);
CREATE INDEX IF NOT EXISTS idx_lectures_classroom_date ON public.lectures (classroom_id, date);
CREATE INDEX IF NOT EXISTS idx_cctv_logs_lecture_time ON public.cctv_attendance_logs (lecture_id, timestamp);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cctv_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cctv_attendance_logs ENABLE ROW LEVEL SECURITY;

-- 7. Policies: Allow read access for authenticated users; restrict updates to administrators
CREATE POLICY "Public read classrooms" ON public.classrooms FOR SELECT USING (true);
CREATE POLICY "Public read lectures" ON public.lectures FOR SELECT USING (true);
CREATE POLICY "Public read attendance logs" ON public.cctv_attendance_logs FOR SELECT USING (true);
