import React, { useState } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Search, 
  Filter, 
  Video, 
  Clock, 
  MapPin, 
  User, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { Classroom, Camera, Lecture, UserRole } from '../types';
import { exportService } from '../services/exportService';

interface LectureManagementViewProps {
  lectures: Lecture[];
  classrooms: Classroom[];
  cameras: Camera[];
  userRole: UserRole;
  onSaveLecture: (lecture: Lecture) => void;
  onNavigateToComparison: (lectureId: string) => void;
}

export const LectureManagementView: React.FC<LectureManagementViewProps> = ({
  lectures,
  classrooms,
  cameras,
  userRole,
  onSaveLecture,
  onNavigateToComparison,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterClassroom, setFilterClassroom] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for Adding a New Lecture
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('CS301');
  const [newSubjectName, setNewSubjectName] = useState('Machine Learning & Neural Systems');
  const [newClassroomId, setNewClassroomId] = useState(classrooms[0]?.id || 'cls_101');
  const [newFacultyName, setNewFacultyName] = useState('Dr. Sarah Jenkins');
  const [newDate, setNewDate] = useState('2026-11-24');
  const [newDayOfWeek, setNewDayOfWeek] = useState('Monday');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('11:30');
  const [newEnrolled, setNewEnrolled] = useState(85);
  const [newTopic, setNewTopic] = useState('');
  const [newCameraId, setNewCameraId] = useState(cameras[0]?.id || 'cam_101');

  // Filtered List
  const filteredLectures = lectures.filter((lec) => {
    const matchesSearch = 
      lec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lec.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lec.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lec.classroomName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject = filterSubject === 'ALL' || lec.subjectCode === filterSubject;
    const matchesClassroom = filterClassroom === 'ALL' || lec.classroomId === filterClassroom;

    return matchesSearch && matchesSubject && matchesClassroom;
  });

  const handleCreateLecture = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClassroom = classrooms.find(c => c.id === newClassroomId);

    const created: Lecture = {
      id: `lec_${Date.now()}`,
      title: newTitle || `${newSubjectCode} Lecture Session`,
      subjectCode: newSubjectCode,
      subjectName: newSubjectName,
      classroomId: newClassroomId,
      classroomName: selectedClassroom ? `${selectedClassroom.name} (${selectedClassroom.code})` : 'Lecture Hall',
      facultyId: 'usr_faculty_1',
      facultyName: newFacultyName,
      date: newDate,
      dayOfWeek: newDayOfWeek,
      startTime: newStartTime,
      endTime: newEndTime,
      enrolledStudents: Number(newEnrolled),
      presentStudents: 0,
      peakStudents: 0,
      averageOccupancyPercent: 0,
      status: 'SCHEDULED',
      cameraId: newCameraId,
      topic: newTopic || 'Core Curriculum Module',
    };

    onSaveLecture(created);
    setIsModalOpen(false);
    setNewTitle('');
    setNewTopic('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Lecture Management & Camera Association</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Schedule academic lectures, assign faculty, and automatically link CCTV streams for attendance logging
          </p>
        </div>

        <div className="flex items-center gap-2">
          {userRole !== 'STUDENT' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-sm shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Lecture</span>
            </button>
          )}

          <button
            onClick={() => exportService.exportToCSV(lectures, 'all_historical_lectures.csv')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by topic, course, faculty, or hall..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Subject:</span>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium"
            >
              <option value="ALL">All Subjects</option>
              <option value="CS301">CS301 (Machine Learning)</option>
              <option value="DS402">DS402 (Computer Vision)</option>
              <option value="MATH201">MATH201 (Linear Algebra)</option>
              <option value="CS101">CS101 (Intro to CS)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Room:</span>
            <select
              value={filterClassroom}
              onChange={(e) => setFilterClassroom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium"
            >
              <option value="ALL">All Classrooms</option>
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Historical Lectures Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Lecture / Course</th>
                <th className="py-3 px-4">Classroom & Camera</th>
                <th className="py-3 px-4">Faculty</th>
                <th className="py-3 px-4">Schedule</th>
                <th className="py-3 px-4 text-center">Enrolled</th>
                <th className="py-3 px-4 text-center">Present (CCTV)</th>
                <th className="py-3 px-4 text-center">Occupancy Rate</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLectures.map((lec) => {
                const camera = cameras.find(c => c.id === lec.cameraId);
                const attendanceRate = lec.enrolledStudents > 0 ? Math.round((lec.presentStudents / lec.enrolledStudents) * 100) : 0;

                return (
                  <tr key={lec.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{lec.subjectCode}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-slate-800 truncate max-w-xs">{lec.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{lec.topic}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-slate-800">{lec.classroomName.split('(')[0]}</p>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Video className="w-3 h-3 text-blue-500" />
                          <span>{camera ? camera.name.split(' ')[0] : 'Auto-Assigned'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {lec.facultyName}
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-800">{lec.dayOfWeek}, {lec.date}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{lec.startTime} - {lec.endTime}</p>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                      {lec.enrolledStudents}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 font-extrabold text-blue-800">
                        {lec.presentStudents}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-slate-800">{attendanceRate}%</span>
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                          <div 
                            className="bg-blue-600 h-full rounded-full" 
                            style={{ width: `${Math.min(100, attendanceRate)}%` }} 
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        lec.status === 'IN_PROGRESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : lec.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {lec.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigateToComparison(lec.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold transition text-[11px]"
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>Compare</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Schedule New Lecture */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Schedule Academic Lecture</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLecture} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject Code</label>
                  <select
                    value={newSubjectCode}
                    onChange={(e) => {
                      setNewSubjectCode(e.target.value);
                      if (e.target.value === 'CS301') setNewSubjectName('Machine Learning & Neural Systems');
                      if (e.target.value === 'DS402') setNewSubjectName('Computer Vision & Object Tracking');
                      if (e.target.value === 'MATH201') setNewSubjectName('Linear Algebra for Computing');
                    }}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="CS301">CS301 - Machine Learning</option>
                    <option value="DS402">DS402 - Computer Vision</option>
                    <option value="MATH201">MATH201 - Linear Algebra</option>
                    <option value="CS101">CS101 - Intro to CS</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lecture Title / Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lecture 6: Recurrent Networks"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Syllabus Topic</label>
                <input
                  type="text"
                  placeholder="e.g. LSTM Cells, Gradient Flow & Temporal Backprop"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Classroom Assigned</label>
                  <select
                    value={newClassroomId}
                    onChange={(e) => setNewClassroomId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name} (Cap: {c.capacity})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Faculty Assigned</label>
                  <input
                    type="text"
                    required
                    value={newFacultyName}
                    onChange={(e) => setNewFacultyName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Enrollment</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newEnrolled}
                    onChange={(e) => setNewEnrolled(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Associated CCTV Stream</label>
                  <select
                    value={newCameraId}
                    onChange={(e) => setNewCameraId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  >
                    {cameras.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-500/20"
                >
                  Save & Link CCTV Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
