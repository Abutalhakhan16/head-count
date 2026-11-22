import { Classroom, Camera, Lecture, User, AttendanceSummaryStats, ActivityLog } from '../types';
import { INITIAL_CLASSROOMS, INITIAL_CAMERAS, INITIAL_LECTURES, INITIAL_USERS } from '../data/mockData';

const STORAGE_KEYS = {
  CLASSROOMS: 'smart_classroom_classrooms_v1',
  CAMERAS: 'smart_classroom_cameras_v1',
  LECTURES: 'smart_classroom_lectures_v1',
  CURRENT_USER: 'smart_classroom_user_v1',
  LOGS: 'smart_classroom_logs_v1',
};

export const storageService = {
  // Classrooms
  getClassrooms(): Classroom[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(INITIAL_CLASSROOMS));
      return INITIAL_CLASSROOMS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_CLASSROOMS;
    }
  },

  saveClassroom(classroom: Classroom): void {
    const list = this.getClassrooms();
    const idx = list.findIndex(c => c.id === classroom.id);
    if (idx >= 0) {
      list[idx] = classroom;
    } else {
      list.unshift(classroom);
    }
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(list));
  },

  // Cameras
  getCameras(): Camera[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMERAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CAMERAS, JSON.stringify(INITIAL_CAMERAS));
      return INITIAL_CAMERAS;
    }
    try {
      const parsed: Camera[] = JSON.parse(raw);
      if (!parsed.some(c => c.id === 'cam_webcam')) {
        const webcamCam = INITIAL_CAMERAS.find(c => c.id === 'cam_webcam');
        if (webcamCam) {
          parsed.unshift(webcamCam);
          localStorage.setItem(STORAGE_KEYS.CAMERAS, JSON.stringify(parsed));
        }
      }
      return parsed;
    } catch {
      return INITIAL_CAMERAS;
    }
  },

  saveCamera(camera: Camera): void {
    const list = this.getCameras();
    const idx = list.findIndex(c => c.id === camera.id);
    if (idx >= 0) {
      list[idx] = camera;
    } else {
      list.unshift(camera);
    }
    localStorage.setItem(STORAGE_KEYS.CAMERAS, JSON.stringify(list));
  },

  // Lectures
  getLectures(): Lecture[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LECTURES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(INITIAL_LECTURES));
      return INITIAL_LECTURES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_LECTURES;
    }
  },

  saveLecture(lecture: Lecture): void {
    const list = this.getLectures();
    const idx = list.findIndex(l => l.id === lecture.id);
    if (idx >= 0) {
      list[idx] = lecture;
    } else {
      list.unshift(lecture);
    }
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(list));
  },

  getCurrentUser(): User {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
      return INITIAL_USERS[0];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS[0];
    }
  },

  setCurrentUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  // Logs
  getLogs(): ActivityLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) {
      const initialLogs: ActivityLog[] = [
        { id: '1', timestamp: '10:42:15', type: 'DETECTION', message: 'YOLOv8 detected 70 students in LH-101. Occupancy 77.8%' },
        { id: '2', timestamp: '10:35:00', type: 'CAMERA', message: 'LH-101 RTSP stream bitrate stable at 4.2 Mbps (30 FPS)' },
        { id: '3', timestamp: '10:00:00', type: 'LECTURE', message: 'Automated CCTV session attached to Lecture 5 (CS301)' },
        { id: '4', timestamp: '09:58:30', type: 'SYSTEM', message: 'Classroom counting region (ROI Zone) calibrated' },
      ];
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(initialLogs));
      return initialLogs;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addLog(entry: Omit<ActivityLog, 'id'>): void {
    const logs = this.getLogs();
    const newLog: ActivityLog = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
    };
    logs.unshift(newLog);
    if (logs.length > 50) logs.pop();
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  },

  // Compute Dashboard Statistics
  getSummaryStats(): AttendanceSummaryStats {
    const lectures = this.getLectures();
    const classrooms = this.getClassrooms();

    // Active or latest lecture
    const inProgress = lectures.find(l => l.status === 'IN_PROGRESS') || lectures[0];
    
    // Total enrolled for active lecture or all active rooms
    const totalEnrolled = inProgress ? inProgress.enrolledStudents : 85;
    const currentDetected = inProgress ? inProgress.presentStudents : 70;
    
    const activeClassroom = classrooms.find(c => c.id === inProgress?.classroomId);
    const capacity = activeClassroom ? activeClassroom.capacity : 90;
    const occupancyPercentage = Math.round((currentDetected / capacity) * 100);

    // Completed lectures sorted chronologically
    const completed = lectures
      .filter(l => l.status === 'COMPLETED' || l.id === inProgress?.id)
      .slice(0, 10);

    const attendances = completed.map(l => l.presentStudents);
    const highestAttendance = Math.max(...attendances, currentDetected);
    const lowestAttendance = Math.min(...attendances, currentDetected);

    // 7-day average (take the last 7 completed records)
    const last7 = completed.slice(0, 7);
    const sum7 = last7.reduce((acc, curr) => acc + curr.presentStudents, 0);
    const average7Days = last7.length > 0 ? Math.round(sum7 / last7.length) : currentDetected;

    // Change compared to previous lecture (e.g. Thu vs Fri for CS301)
    // Find the immediately preceding lecture for this subject/classroom
    const previous = lectures.find(l => l.id !== inProgress.id && l.subjectCode === inProgress.subjectCode);
    const prevCount = previous ? previous.presentStudents : 65;
    const diff = currentDetected - prevCount;
    const percentage = prevCount > 0 ? Number(((diff / prevCount) * 100).toFixed(2)) : 0;

    return {
      totalEnrolled,
      currentDetected,
      occupancyPercentage,
      average7Days,
      highestAttendance,
      lowestAttendance,
      changeVsPrevious: {
        diff,
        percentage,
        trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'EQUAL',
      },
    };
  },

  resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(INITIAL_CLASSROOMS));
    localStorage.setItem(STORAGE_KEYS.CAMERAS, JSON.stringify(INITIAL_CAMERAS));
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(INITIAL_LECTURES));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
    localStorage.removeItem(STORAGE_KEYS.LOGS);
  }
};
