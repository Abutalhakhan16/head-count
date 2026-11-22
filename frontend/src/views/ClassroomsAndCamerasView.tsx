import React, { useState } from 'react';
import { 
  Building2, 
  Camera as CameraIcon, 
  Plus, 
  Wifi, 
  CheckCircle2, 
  AlertCircle, 
  Video, 
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  X
} from 'lucide-react';
import { Classroom, Camera } from '../types';

interface ClassroomsAndCamerasViewProps {
  classrooms: Classroom[];
  cameras: Camera[];
  onSaveClassroom: (classroom: Classroom) => void;
  onSaveCamera: (camera: Camera) => void;
}

export const ClassroomsAndCamerasView: React.FC<ClassroomsAndCamerasViewProps> = ({
  classrooms,
  cameras,
  onSaveClassroom,
  onSaveCamera,
}) => {
  const [activeTab, setActiveTab] = useState<'CLASSROOMS' | 'CAMERAS'>('CLASSROOMS');
  const [isAddClassroomModalOpen, setIsAddClassroomModalOpen] = useState(false);
  const [isAddCameraModalOpen, setIsAddCameraModalOpen] = useState(false);
  const [pingingCamId, setPingingCamId] = useState<string | null>(null);

  // Form State: Classroom
  const [cCode, setCCode] = useState('');
  const [cName, setCName] = useState('');
  const [cBuilding, setCBuilding] = useState('Computing Sciences Complex');
  const [cFloor, setCFloor] = useState(1);
  const [cCapacity, setCCapacity] = useState(80);

  // Form State: Camera
  const [camName, setCamName] = useState('');
  const [camClassroomId, setCamClassroomId] = useState(classrooms[0]?.id || 'cls_101');
  const [camRtsp, setCamRtsp] = useState('rtsp://admin:stream@192.168.1.105:554/live/main');
  const [camIp, setCamIp] = useState('192.168.1.105');
  const [camPort, setCamPort] = useState(554);
  const [camResolution, setCamResolution] = useState('1920x1080 (1080p)');
  const [camFps, setCamFps] = useState(30);

  const handleTestPing = (camId: string) => {
    setPingingCamId(camId);
    setTimeout(() => {
      setPingingCamId(null);
    }, 1200);
  };

  const handleAddClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    const newClassroom: Classroom = {
      id: `cls_${Date.now()}`,
      code: cCode,
      name: cName,
      building: cBuilding,
      floor: Number(cFloor),
      capacity: Number(cCapacity),
      status: 'ACTIVE',
    };
    onSaveClassroom(newClassroom);
    setIsAddClassroomModalOpen(false);
    setCCode('');
    setCName('');
  };

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedClassroom = classrooms.find(c => c.id === camClassroomId);
    const newCam: Camera = {
      id: `cam_${Date.now()}`,
      name: camName,
      classroomId: camClassroomId,
      classroomName: assignedClassroom ? assignedClassroom.name : 'Classroom',
      rtspUrl: camRtsp,
      ipAddress: camIp,
      port: Number(camPort),
      status: 'ONLINE',
      resolution: camResolution,
      fps: Number(camFps),
      bitrate: '4.5 Mbps',
      latencyMs: 140,
      lastPing: 'Just now',
      roiZone: { x: 5, y: 15, width: 90, height: 80 },
    };
    onSaveCamera(newCam);
    setIsAddCameraModalOpen(false);
    setCamName('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Classrooms & RTSP CCTV Cameras</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure physical learning spaces, IP camera streams, and video inference endpoints
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('CLASSROOMS')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'CLASSROOMS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Classrooms ({classrooms.length})
            </button>
            <button
              onClick={() => setActiveTab('CAMERAS')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'CAMERAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              CCTV Streams ({cameras.length})
            </button>
          </div>

          {activeTab === 'CLASSROOMS' ? (
            <button
              onClick={() => setIsAddClassroomModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Classroom</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddCameraModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Camera</span>
            </button>
          )}
        </div>
      </div>

      {/* Classrooms Tab */}
      {activeTab === 'CLASSROOMS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((cls) => {
            const cam = cameras.find(c => c.id === cls.cameraId);
            return (
              <div 
                key={cls.id} 
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-blue-400 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800">
                      {cls.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {cls.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{cls.name}</h3>
                    <p className="text-xs text-slate-500">{cls.building} • Floor {cls.floor}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Physical Seating Capacity:</span>
                      <span className="font-bold text-slate-900">{cls.capacity} Seats</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>CCTV Feed:</span>
                      <span className="font-semibold text-blue-600 truncate max-w-[150px]">
                        {cam ? cam.name : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px]">AI Vision Enabled</span>
                  <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                    View Schedule →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cameras Tab */}
      {activeTab === 'CAMERAS' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Camera Identifier</th>
                    <th className="py-3 px-4">Assigned Classroom</th>
                    <th className="py-3 px-4">RTSP Stream URL</th>
                    <th className="py-3 px-4">Resolution & FPS</th>
                    <th className="py-3 px-4">Bitrate / Latency</th>
                    <th className="py-3 px-4 text-center">Connection</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cameras.map((cam) => {
                    const isPinging = pingingCamId === cam.id;
                    return (
                      <tr key={cam.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="font-bold text-slate-900">{cam.name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{cam.ipAddress}:{cam.port}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {cam.classroomName}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-600 max-w-xs truncate">
                          {cam.rtspUrl}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">{cam.resolution}</p>
                          <p className="text-[11px] text-slate-500">{cam.fps} FPS target</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">{cam.bitrate}</p>
                          <p className="text-[11px] text-slate-500">{cam.latencyMs} ms ping</p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {cam.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleTestPing(cam.id)}
                            disabled={isPinging}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                          >
                            <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-blue-600' : ''}`} />
                            <span>{isPinging ? 'Pinging...' : 'Test Ping'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Classroom */}
      {isAddClassroomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Classroom</h3>
              <button onClick={() => setIsAddClassroomModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddClassroom} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LH-201"
                  value={cCode}
                  onChange={e => setCCode(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Claude Shannon Lecture Hall"
                  value={cName}
                  onChange={e => setCName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    required
                    value={cCapacity}
                    onChange={e => setCCapacity(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor</label>
                  <input
                    type="number"
                    required
                    value={cFloor}
                    onChange={e => setCFloor(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddClassroomModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20"
                >
                  Create Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Connect Camera */}
      {isAddCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Connect IP CCTV Camera</h3>
              <button onClick={() => setIsAddCameraModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddCamera} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CR-401 Panoramic AI Camera"
                  value={camName}
                  onChange={e => setCamName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Classroom Assigned</label>
                <select
                  value={camClassroomId}
                  onChange={e => setCamClassroomId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">RTSP Stream URL</label>
                <input
                  type="text"
                  required
                  value={camRtsp}
                  onChange={e => setCamRtsp(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IP Address</label>
                  <input
                    type="text"
                    required
                    value={camIp}
                    onChange={e => setCamIp(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={camPort}
                    onChange={e => setCamPort(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCameraModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20"
                >
                  Save & Validate Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
