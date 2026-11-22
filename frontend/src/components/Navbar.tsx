import React, { useState } from 'react';
import { 
  Video, 
  Shield, 
  GraduationCap, 
  UserCheck, 
  ChevronDown, 
  Bell, 
  Server, 
  Radio, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../data/mockData';

interface NavbarProps {
  currentUser: User;
  onSwitchUser: (user: User) => void;
  backendOnline: boolean;
  onOpenBackendInfo: () => void;
  activeLectureCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSwitchUser,
  backendOnline,
  onOpenBackendInfo,
  activeLectureCount,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'FACULTY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <GraduationCap className="w-3 h-3" /> Faculty
          </span>
        );
      case 'STUDENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-3 h-3" /> Student
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Smart Classroom <span className="text-blue-600">Analytics</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                AI Vision
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden md:block">
              Continuous Automated Occupancy & Lecture Attendance Verification
            </p>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-600 font-medium">Live Detection:</span>
            <span className="font-bold text-slate-900">{activeLectureCount} Active In Hall 101</span>
          </div>

          <button
            onClick={onOpenBackendInfo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              backendOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>{backendOnline ? 'Python YOLOv8: Live' : 'Demo Stream Mode'}</span>
            <span className="text-[10px] opacity-75">ℹ️</span>
          </button>
        </div>

        {/* Right Section: Role Switcher & User Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition"
              title="Switch user role to preview Admin, Faculty, or Student perspectives"
            >
              <span className="text-slate-500">Role:</span>
              <span className="font-semibold text-slate-900">{currentUser.role}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {roleDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onMouseLeave={() => setRoleDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-800">Switch Role View</p>
                  <p className="text-[11px] text-slate-500">Experience role-based dashboard permissions</p>
                </div>
                {INITIAL_USERS.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onSwitchUser(u);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition ${
                      currentUser.id === u.id ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <img 
                      src={u.avatar} 
                      alt={u.name} 
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-900 truncate">{u.name}</p>
                        {getRoleBadge(u.role)}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{u.department}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Avatar & Name */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/20"
            />
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500">{currentUser.department}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
