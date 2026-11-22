import React from 'react';
import { Server, CheckCircle2, AlertTriangle, X, Terminal, Cpu, ShieldCheck, Video, Target } from 'lucide-react';
import { BackendStatus } from '../services/aiBackendService';

interface BackendInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendStatus: BackendStatus;
  onProbeBackend: () => void;
}

export const BackendInfoModal: React.FC<BackendInfoModalProps> = ({
  isOpen,
  onClose,
  backendStatus,
  onProbeBackend,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">AI Head & Person Vision Engine</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
          backendStatus.online 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {backendStatus.online ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold text-sm">
              {backendStatus.online ? 'FastAPI & YOLOv8 + Head Cascades Active' : 'In-Browser Vision Active'}
            </p>
            <p className="mt-1 opacity-90 leading-relaxed">
              {backendStatus.online 
                ? 'Real-time AI Head Counting through camera is fully operational with ROI tracking and ByteTrack metrics via the integrated /api vision service.'
                : 'The Vision API is currently unavailable at /api. In-browser camera vision is active for live camera streaming.'
              }
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700">Head & Face Cascades</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-slate-700">Live Camera (Webcam)</span>
          </div>
        </div>

        {/* Instructions on how to launch the backend */}
        <div className="space-y-2 text-xs">
          <p className="font-bold text-slate-700">Integrated Node.js Vision Server:</p>
          <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1">
            <p className="text-slate-400"># Start unified Frontend & Vision API on port 3000:</p>
            <p className="text-emerald-400">npm run dev</p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">/api/status</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onProbeBackend}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20"
            >
              Test Connection
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
