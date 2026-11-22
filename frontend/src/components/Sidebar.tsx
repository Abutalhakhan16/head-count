import React from 'react';
import { 
  LayoutDashboard, 
  Camera, 
  GitCompare, 
  CalendarDays, 
  BarChart3, 
  Building2, 
  Settings, 
  EyeOff,
  Sparkles,
  Info
} from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 
  | 'dashboard' 
  | 'cctv' 
  | 'comparison' 
  | 'lectures' 
  | 'reports' 
  | 'classrooms' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole: UserRole;
  isBackendOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  isBackendOnline,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'FACULTY', 'STUDENT'] as UserRole[],
      badge: null,
    },
    {
      id: 'comparison' as NavTab,
      label: 'Lecture Comparison',
      icon: GitCompare,
      roles: ['ADMIN', 'FACULTY', 'STUDENT'] as UserRole[],
      badge: 'Core',
    },
    {
      id: 'cctv' as NavTab,
      label: 'CCTV Live Monitor',
      icon: Camera,
      roles: ['ADMIN', 'FACULTY'] as UserRole[],
      badge: 'Live AI',
    },
    {
      id: 'lectures' as NavTab,
      label: 'Lecture Management',
      icon: CalendarDays,
      roles: ['ADMIN', 'FACULTY'] as UserRole[],
      badge: null,
    },
    {
      id: 'reports' as NavTab,
      label: 'Analytics & Reports',
      icon: BarChart3,
      roles: ['ADMIN', 'FACULTY', 'STUDENT'] as UserRole[],
      badge: 'PDF/CSV',
    },
    {
      id: 'classrooms' as NavTab,
      label: 'Classrooms & RTSP',
      icon: Building2,
      roles: ['ADMIN'] as UserRole[],
      badge: null,
    },
    {
      id: 'settings' as NavTab,
      label: 'System & Supabase',
      icon: Settings,
      roles: ['ADMIN'] as UserRole[],
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        {/* Navigation Category */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
              {userRole}
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const hasAccess = item.roles.includes(userRole);
              const isActive = currentTab === item.id;

              if (!hasAccess) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-300 cursor-not-allowed select-none"
                    title={`Restricted to ${item.roles.join(', ')}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="w-4 h-4 text-slate-300" />
                      <span>{item.label}</span>
                    </div>
                    <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tight ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badge === 'Core'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Status Information Box */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-100 text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Computer Vision Status</span>
          </div>
          <p className="text-[11px] text-slate-600 mb-2">
            AI-based people counting active without facial identification. Privacy-first architecture.
          </p>
          <div className="space-y-1 text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-200/60">
            <div className="flex justify-between">
              <span>Model:</span>
              <span className="font-semibold text-slate-700">YOLOv8n + ByteTrack</span>
            </div>
            <div className="flex justify-between">
              <span>Detection Zone:</span>
              <span className="font-semibold text-emerald-600">ROI Active (90%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
        <p className="font-medium text-slate-500">Smart Classroom Analytics</p>
        <p>v2.4.0 • Enterprise Edition</p>
      </div>
    </aside>
  );
};
