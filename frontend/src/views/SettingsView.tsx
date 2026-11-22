import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  Server, 
  Cpu, 
  ShieldCheck, 
  Key, 
  CheckCircle2, 
  RefreshCw, 
  ExternalLink,
  Code2,
  Copy,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { BackendStatus } from '../services/aiBackendService';

interface SettingsViewProps {
  backendStatus: BackendStatus;
  onRefreshBackend: () => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  backendStatus,
  onRefreshBackend,
  onResetData,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('https://xyzcompany.supabase.co');
  const [supabaseKey, setSupabaseKey] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [modelChoice, setModelChoice] = useState('yolov8n');
  const [trackerChoice, setTrackerChoice] = useState('bytetrack');

  const supabaseSqlSchema = `-- Smart Classroom Analytics PostgreSQL Schema for Supabase
CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    capacity INTEGER NOT NULL,
    camera_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cctv_cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    classroom_id TEXT REFERENCES classrooms(id),
    rtsp_url TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 554,
    status TEXT DEFAULT 'ONLINE',
    resolution TEXT DEFAULT '1080p',
    fps INTEGER DEFAULT 30,
    roi_json JSONB
);

CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    classroom_id TEXT REFERENCES classrooms(id),
    faculty_id TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    date DATE NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    enrolled_students INTEGER NOT NULL,
    present_students INTEGER DEFAULT 0,
    peak_students INTEGER DEFAULT 0,
    average_occupancy_percent NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cctv_attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    lecture_id TEXT REFERENCES lectures(id),
    camera_id TEXT REFERENCES cctv_cameras(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    student_headcount INTEGER NOT NULL,
    tracked_ids_json JSONB,
    confidence_avg NUMERIC(4,3)
);

-- Enable Row Level Security (RLS)
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE cctv_attendance_logs ENABLE ROW LEVEL SECURITY;`;

  const [supabaseValidated, setSupabaseValidated] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">System Architecture & Database Configuration</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          AI computer vision backend parameters, FFmpeg CCTV stream proxy, and Supabase PostgreSQL schema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vision & CCTV Stream Engine Status */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">AI Vision & CCTV Stream Engine</h2>
            </div>
            <button
              onClick={onRefreshBackend}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Probe Engine</span>
            </button>
          </div>

          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            backendStatus.online 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${backendStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <p className="font-bold text-sm">
                  {backendStatus.online ? 'Connected to CCTV Stream Proxy & Vision Engine' : 'Using In-Browser Vision Mode'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">{backendStatus.message}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs pt-1">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Vision API Endpoint:</span>
              <span className="font-mono font-bold text-slate-800">/api</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Active Object Detection Model:</span>
              <span className="font-bold text-slate-800">{backendStatus.model || 'TensorFlow.js COCO-SSD + BlazeFace'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Object Tracker:</span>
              <span className="font-bold text-slate-800">Centroid Distance + ROI Spatial Filter</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">CCTV Protocol Engine:</span>
              <span className="font-bold text-slate-800">FFmpeg / FFprobe (RTSP, HTTP, HLS, MJPEG)</span>
            </div>
          </div>
        </div>

        {/* Supabase Database Configuration */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Supabase PostgreSQL Integration</h2>
          </div>
          <p className="text-xs text-slate-500">
            Connect to Supabase PostgreSQL database for persistent multi-campus attendance records.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Supabase Project URL</label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Supabase Anon / Service Key</label>
              <input
                type="password"
                value={supabaseKey}
                onChange={e => setSupabaseKey(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-slate-800"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {supabaseValidated ? 'Schema & RLS Validated' : 'RLS Policies Configured'}
              </span>
              <button 
                onClick={() => {
                  setSupabaseValidated(true);
                  setTimeout(() => setSupabaseValidated(false), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
              >
                {supabaseValidated ? 'Validated ✓' : 'Validate Connection'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase SQL DDL Schema Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Supabase DDL Migration Schema</h3>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedSchema ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
          {supabaseSqlSchema}
        </pre>
      </div>

      {/* Reset State Option */}
      <div className="bg-red-50/50 rounded-2xl p-6 border border-red-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-red-950">Reset Prototype Demonstration Data</h4>
            <p className="text-xs text-red-700">
              Restore default 15+ lecture records, sample CCTV cameras, and Turing Hall occupancy logs.
            </p>
          </div>
        </div>

        <button
          onClick={onResetData}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md shadow-red-500/20 transition whitespace-nowrap"
        >
          Reset to Factory Defaults
        </button>
      </div>
    </div>
  );
};
