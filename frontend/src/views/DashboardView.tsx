import React from 'react';
import { 
  Users, 
  UserCheck, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  Video, 
  Clock, 
  MapPin, 
  Calendar,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { Classroom, Lecture, AttendanceSummaryStats, UserRole } from '../types';

interface DashboardViewProps {
  stats: AttendanceSummaryStats;
  lectures: Lecture[];
  classrooms: Classroom[];
  userRole: UserRole;
  onNavigateToComparison: (lectureId?: string) => void;
  onNavigateToCCTV: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  lectures,
  classrooms,
  userRole,
  onNavigateToComparison,
  onNavigateToCCTV,
}) => {
  // Active lecture (e.g. Friday CS301)
  const activeLecture = lectures.find(l => l.status === 'IN_PROGRESS') || lectures[0];
  const activeClassroom = classrooms.find(c => c.id === activeLecture?.classroomId);

  // Prepare chart data for last 7 lectures
  const chartData = lectures
    .slice()
    .reverse()
    .slice(-8)
    .map((l) => ({
      name: `${l.dayOfWeek.slice(0, 3)} (${l.subjectCode})`,
      present: l.presentStudents,
      enrolled: l.enrolledStudents,
      capacity: classrooms.find(c => c.id === l.classroomId)?.capacity || 90,
      occupancy: l.averageOccupancyPercent,
      date: l.date,
    }));

  return (
    <div className="space-y-6">
      {/* Welcome Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            AI Computer Vision Active
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Classroom Occupancy & Attendance Dashboard
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Real-time people counting from existing classroom CCTV infrastructure. Bounding-box detection without biometric face identification.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {userRole !== 'STUDENT' && (
            <button
              onClick={onNavigateToCCTV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-500/25"
            >
              <Video className="w-4 h-4" />
              <span>Live CCTV Feed</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToComparison()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition backdrop-blur"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Lecture Comparison</span>
          </button>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* 7 Core Requirement Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Current Students Detected */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Current Detected
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.currentDetected}
            </span>
            <span className="text-xs text-slate-500 font-medium">students visible</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live from {activeLecture?.classroomName.split('(')[0]}</span>
          </div>
        </div>

        {/* Card 2: Classroom Occupancy % */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Room Occupancy
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.occupancyPercentage}%
            </span>
            <span className="text-xs text-slate-500 font-medium">of {activeClassroom?.capacity || 90} cap</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                stats.occupancyPercentage > 85
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${Math.min(100, stats.occupancyPercentage)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Total Enrolled */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Enrolled Students
            </span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.totalEnrolled}
            </span>
            <span className="text-xs text-slate-500 font-medium">registered in {activeLecture?.subjectCode}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Attendance Rate: <span className="font-semibold text-slate-800">{Math.round((stats.currentDetected / stats.totalEnrolled) * 100)}%</span>
          </p>
        </div>

        {/* Card 4: Change vs Previous Lecture */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              vs. Previous Lecture
            </span>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                stats.changeVsPrevious.trend === 'UP'
                  ? 'bg-emerald-50 text-emerald-600'
                  : stats.changeVsPrevious.trend === 'DOWN'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {stats.changeVsPrevious.trend === 'UP' ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : stats.changeVsPrevious.trend === 'DOWN' ? (
                <ArrowDownRight className="w-5 h-5" />
              ) : (
                <Minus className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.changeVsPrevious.diff > 0 ? `+${stats.changeVsPrevious.diff}` : stats.changeVsPrevious.diff}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                stats.changeVsPrevious.trend === 'UP'
                  ? 'bg-emerald-100 text-emerald-800'
                  : stats.changeVsPrevious.trend === 'DOWN'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {stats.changeVsPrevious.percentage > 0 ? `+${stats.changeVsPrevious.percentage}%` : `${stats.changeVsPrevious.percentage}%`}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Compared to Lecture 4 (80 students on Thu)
          </p>
        </div>
      </div>

      {/* Secondary Metric Bar (7-Day Avg, Highest, Lowest) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Average Attendance (Last 7 Days)</p>
            <p className="text-xl font-extrabold text-slate-900">{stats.average7Days} Students</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Highest Attendance Recorded</p>
            <p className="text-xl font-extrabold text-emerald-700">{stats.highestAttendance} Students <span className="text-xs font-normal text-slate-500">(Thu Lecture 4)</span></p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Lowest Attendance Recorded</p>
            <p className="text-xl font-extrabold text-slate-800">{stats.lowestAttendance} Students <span className="text-xs font-normal text-slate-500">(Wed Lecture 3)</span></p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Charts & Active Room Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance Trends Across Recent Lectures</h2>
              <p className="text-xs text-slate-500">
                Continuous vision counting verifying classroom seat occupancy per scheduled session
              </p>
            </div>
            <button
              onClick={() => onNavigateToComparison()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              <span>Detailed Comparison Matrix</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false}
                  domain={[0, 95]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-blue-300">{data.name}</p>
                          <p className="text-slate-300">Date: {data.date}</p>
                          <p className="font-extrabold text-sm text-white">Present: {data.present} students</p>
                          <p className="text-slate-400">Enrolled: {data.enrolled} (Occupancy: {data.occupancy}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorPresent)" 
                  name="Detected Students"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                AI Counted Students
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-slate-300 inline-block" />
                Room Baseline
              </span>
            </div>
            <span>Updated real-time from CCTV streams</span>
          </div>
        </div>

        {/* Right Col: Active Live Classroom Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE SESSION
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {activeLecture?.startTime} - {activeLecture?.endTime}
              </span>
            </div>

            <div>
              <span className="text-xs font-bold text-blue-600">{activeLecture?.subjectCode}</span>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {activeLecture?.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{activeLecture?.topic}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeLecture?.classroomName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Faculty: {activeLecture?.facultyName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Video className="w-3.5 h-3.5 text-slate-400" />
                <span>CCTV: LH-101 Front Overhead HD (30 FPS)</span>
              </div>
            </div>

            {/* Live Count Meter */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-center space-y-1">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                Current Attendance Count
              </p>
              <p className="text-4xl font-extrabold text-blue-900 tracking-tight">
                {stats.currentDetected} <span className="text-base font-medium text-blue-600">/ {stats.totalEnrolled}</span>
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {stats.occupancyPercentage}% Classroom Seat Utilization
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            {userRole !== 'STUDENT' ? (
              <button
                onClick={onNavigateToCCTV}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition"
              >
                <Video className="w-4 h-4 text-blue-400" />
                <span>Open Live Camera Feed & Bounding Boxes</span>
              </button>
            ) : (
              <div className="text-center text-xs text-slate-400 py-2">
                Student Mode • Feed restricted to Faculty/Admin
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Classroom Status Grid */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Classroom Occupancy Overview</h3>
            <p className="text-xs text-slate-500">Live camera monitoring status across campus halls</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {classrooms.length} Managed Classrooms
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {classrooms.map((cls) => {
            const isCurrent = cls.id === activeLecture?.classroomId;
            const currentHeadcount = isCurrent ? stats.currentDetected : cls.status === 'ACTIVE' ? Math.round(cls.capacity * 0.72) : 0;
            const occ = Math.round((currentHeadcount / cls.capacity) * 100);

            return (
              <div 
                key={cls.id}
                className={`p-4 rounded-xl border transition ${
                  isCurrent 
                    ? 'border-blue-400 bg-blue-50/30 ring-1 ring-blue-400/20' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-900">{cls.code}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    cls.status === 'ACTIVE' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {cls.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 truncate">{cls.name}</h4>
                <p className="text-[11px] text-slate-500">{cls.building} • Floor {cls.floor}</p>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Occupancy</span>
                    <span className="font-extrabold text-slate-900">{currentHeadcount} / {cls.capacity}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Rate</span>
                    <span className={`font-bold ${occ > 80 ? 'text-blue-600' : 'text-slate-700'}`}>{occ}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
