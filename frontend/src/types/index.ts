export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export interface Classroom {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  cameraId?: string;
  status: 'ACTIVE' | 'IDLE' | 'MAINTENANCE';
}

export interface Camera {
  id: string;
  name: string;
  classroomId: string;
  classroomName: string;
  rtspUrl: string;
  ipAddress: string;
  port: number;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING';
  resolution: string;
  fps: number;
  bitrate: string;
  latencyMs: number;
  lastPing: string;
  roiZone?: {
    x: number; // percentage 0-100
    y: number;
    width: number;
    height: number;
  };
}

export interface Lecture {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  classroomId: string;
  classroomName: string;
  facultyId: string;
  facultyName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  startTime: string; // HH:mm
  endTime: string;
  enrolledStudents: number;
  presentStudents: number;
  peakStudents: number;
  averageOccupancyPercent: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  cameraId?: string;
  topic?: string;
}

export interface DetectionBox {
  id: number;
  x: number; // 0 to 1 normalized
  y: number;
  width: number;
  height: number;
  confidence: number;
  trackId: number;
  inRoi: boolean;
}

export interface ComparisonMetrics {
  currentLecture: Lecture;
  previousLecture: Lecture;
  countDifference: number;
  percentageChange: number;
  historicalAverage: number;
  baselineDiff: number;
  baselinePercentageChange: number;
  trend: 'UP' | 'DOWN' | 'EQUAL';
}

export type ComparisonMode = 
  | 'PREVIOUS_LECTURE' 
  | 'PREVIOUS_DAY' 
  | 'PREVIOUS_WEEK' 
  | 'SAME_WEEKDAY' 
  | 'CUSTOM';

export interface AttendanceSummaryStats {
  totalEnrolled: number;
  currentDetected: number;
  occupancyPercentage: number;
  average7Days: number;
  highestAttendance: number;
  lowestAttendance: number;
  changeVsPrevious: {
    diff: number;
    percentage: number;
    trend: 'UP' | 'DOWN' | 'EQUAL';
  };
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'DETECTION' | 'CAMERA' | 'LECTURE' | 'SYSTEM';
  message: string;
  meta?: any;
}
