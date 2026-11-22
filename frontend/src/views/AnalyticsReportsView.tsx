import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Building, 
  BookOpen, 
  Layers,
  Sparkles,
  PieChart as PieIcon,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Lecture, Classroom, AttendanceSummaryStats, UserRole } from '../types';
import { exportService } from '../services/exportService';

interface AnalyticsReportsViewProps {
  lectures: Lecture[];
  classrooms: Classroom[];
  stats: AttendanceSummaryStats;
  userRole: UserRole;
}

export const AnalyticsReportsView: React.FC<AnalyticsReportsViewProps> = ({
  lectures,
  classrooms,
  stats,
  userRole,
}) => {
  const [timeframe, setTimeframe] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Subject-wise attendance aggregation
  const subjectData = [
    { name: 'CS301 Machine Learning', avgAttendance: 69, enrolled: 85, occupancy: 78 },
    { name: 'DS402 Computer Vision', avgAttendance: 37, enrolled: 42, occupancy: 82 },
    { name: 'MATH201 Linear Algebra', avgAttendance: 49, enrolled: 55, occupancy: 82 },
    { name: 'CS101 Intro Computing', avgAttendance: 138, enrolled: 160, occupancy: 77 },
  ];

  // Classroom utilization distribution
  const classroomOccupancyData = classrooms.map(c => {
    const classLectures = lectures.filter(l => l.classroomId === c.id);
    const avgPresent = classLectures.length > 0 
      ? Math.round(classLectures.reduce((acc, curr) => acc + curr.presentStudents, 0) / classLectures.length)
      : Math.round(c.capacity * 0.75);
    return {
      name: c.code,
      fullName: c.name,
      avgPresent,
      capacity: c.capacity,
      rate: Math.round((avgPresent / c.capacity) * 100),
    };
  });

  // Peak attendance hour breakdown
  const peakHourData = [
    { hour: '08:00 - 10:00', avgCount: 50, peakRatio: '78%' },
    { hour: '10:00 - 12:00', avgCount: 76, peakRatio: '92%' }, // Peak Period
    { hour: '12:00 - 14:00', avgCount: 42, peakRatio: '65%' },
    { hour: '14:00 - 16:00', avgCount: 68, peakRatio: '84%' },
    { hour: '16:00 - 18:00', avgCount: 54, peakRatio: '71%' },
  ];

  // Trend data based on timeframe toggle
  const trendData = timeframe === 'DAILY' 
    ? [
        { date: 'Mon 11/17', count: 65, rate: 76 },
        { date: 'Tue 11/18', count: 72, rate: 85 },
        { date: 'Wed 11/19', count: 58, rate: 68 },
        { date: 'Thu 11/20', count: 80, rate: 94 },
        { date: 'Fri 11/21', count: 70, rate: 82 },
      ]
    : timeframe === 'WEEKLY'
    ? [
        { date: 'Week 43 (Oct)', count: 64, rate: 75 },
        { date: 'Week 44 (Nov)', count: 68, rate: 80 },
        { date: 'Week 45 (Nov)', count: 62, rate: 73 },
        { date: 'Week 46 (Nov)', count: 70, rate: 82 },
      ]
    : [
        { date: 'September', count: 61, rate: 72 },
        { date: 'October', count: 67, rate: 79 },
        { date: 'November', count: 69, rate: 81 },
      ];

  const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706'];

  const handleDownloadPDF = () => {
    setDownloadingPdf(true);
    setTimeout(() => {
      exportService.exportToPDF(lectures, stats, 'Institutional_Classroom_Attendance_Report');
      setDownloadingPdf(false);
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Header and Download Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Comprehensive Attendance Analytics & Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Institutional intelligence generated via CCTV person detection. Exportable formal audits.
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportService.exportToCSV(lectures, 'smart_classroom_analytics_full.csv')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-500/25"
          >
            <FileText className="w-4 h-4 text-white" />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Timeframe Filter for Trend Analysis */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Attendance Trajectory & Trends</h2>
            <p className="text-xs text-slate-500">
              Aggregated student presence over selected temporal intervals
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeframe === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t} Trends
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 90]} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1">
                        <p className="font-bold text-blue-300">{data.date}</p>
                        <p className="text-sm font-extrabold text-white">Avg Count: {data.count} Students</p>
                        <p className="text-emerald-400">Classroom Rate: {data.rate}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Layout: Subject-Wise & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject-Wise Attendance Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Subject-Wise Attendance Comparison</h3>
            <p className="text-xs text-slate-500">Average student presence vs course registration</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => val.split(' ')[0]} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="avgAttendance" name="Average Present" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="enrolled" name="Enrolled" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Attendance Periods */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Peak Attendance Periods</h3>
            <p className="text-xs text-slate-500">Classroom utilization grouped by academic time blocks</p>
          </div>

          <div className="space-y-3 pt-2">
            {peakHourData.map((item, idx) => {
              const isPeak = item.hour.includes('10:00 - 12:00');
              return (
                <div 
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    isPeak ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-300/30' : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`w-4 h-4 ${isPeak ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="font-bold text-slate-900">{item.hour}</p>
                      <p className="text-[11px] text-slate-500">
                        {isPeak ? 'Campus Peak Occupancy Window' : 'Standard Lecture Block'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 text-sm">{item.avgCount} Students</span>
                    <span className={`block text-[11px] font-bold ${isPeak ? 'text-blue-700' : 'text-slate-500'}`}>
                      {item.peakRatio} Capacity
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Classroom-Wise Occupancy Breakdown Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Classroom Utilization & Headcount Summary</h3>
          <p className="text-xs text-slate-500">Hall-by-hall physical seat occupancy performance</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {classroomOccupancyData.map((c, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-slate-900">{c.name}</span>
                <span className="text-xs font-bold text-blue-600">{c.rate}%</span>
              </div>
              <p className="text-xs font-medium text-slate-700 truncate">{c.fullName}</p>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full" 
                  style={{ width: `${c.rate}%` }} 
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Avg: {c.avgPresent} students</span>
                <span>Cap: {c.capacity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
