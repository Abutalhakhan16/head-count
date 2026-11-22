import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { BackendInfoModal } from './components/BackendInfoModal';
import { DashboardView } from './views/DashboardView';
import { CCTVMonitoringView } from './views/CCTVMonitoringView';
import { LectureComparisonView } from './views/LectureComparisonView';
import { LectureManagementView } from './views/LectureManagementView';
import { AnalyticsReportsView } from './views/AnalyticsReportsView';
import { ClassroomsAndCamerasView } from './views/ClassroomsAndCamerasView';
import { SettingsView } from './views/SettingsView';

import { storageService } from './services/storage.ts';
import { aiBackendService, BackendStatus } from './services/aiBackendService.ts';
import { User, Classroom, Camera, Lecture } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<User>(() => storageService.getCurrentUser());
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  
  // Data State
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => storageService.getClassrooms());
  const [cameras, setCameras] = useState<Camera[]>(() => storageService.getCameras());
  const [lectures, setLectures] = useState<Lecture[]>(() => storageService.getLectures());
  
  // Backend Status State
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    online: false,
    message: 'Checking Python FastAPI service...',
  });
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);

  // Active target for lecture comparison
  const [comparisonTargetId, setComparisonTargetId] = useState<string | null>(null);

  // Poll / Probe backend on load
  const probeBackend = async () => {
    const status = await aiBackendService.checkStatus();
    setBackendStatus(status);
  };

  useEffect(() => {
    probeBackend();
    const interval = setInterval(probeBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync user change
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    storageService.setCurrentUser(user);

    // If switching to student while on restricted tab, send to dashboard
    if (user.role === 'STUDENT' && (currentTab === 'cctv' || currentTab === 'classrooms' || currentTab === 'settings' || currentTab === 'lectures')) {
      setCurrentTab('dashboard');
    }
  };

  // Lecture Actions
  const handleSaveLecture = (newLecture: Lecture) => {
    storageService.saveLecture(newLecture);
    setLectures(storageService.getLectures());
  };

  // Classroom Actions
  const handleSaveClassroom = (newClassroom: Classroom) => {
    storageService.saveClassroom(newClassroom);
    setClassrooms(storageService.getClassrooms());
  };

  // Camera Actions
  const handleSaveCamera = (newCamera: Camera) => {
    storageService.saveCamera(newCamera);
    setCameras(storageService.getCameras());
  };

  // Reset Data
  const handleResetData = () => {
    if (window.confirm('Are you sure you want to restore the prototype database to default demo records?')) {
      storageService.resetToDefaults();
      setClassrooms(storageService.getClassrooms());
      setCameras(storageService.getCameras());
      setLectures(storageService.getLectures());
      setCurrentUser(storageService.getCurrentUser());
      alert('Default records restored successfully.');
    }
  };

  // Navigation Helpers
  const handleNavigateToComparison = (lectureId?: string) => {
    if (lectureId) setComparisonTargetId(lectureId);
    setCurrentTab('comparison');
  };

  const handleNavigateToCCTV = () => {
    if (currentUser.role === 'STUDENT') {
      alert('Access restricted: Live CCTV feeds are reserved for Faculty and Administrators.');
      return;
    }
    setCurrentTab('cctv');
  };

  const summaryStats = storageService.getSummaryStats();
  const activeLectures = lectures.filter(l => l.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        backendOnline={backendStatus.online}
        onOpenBackendInfo={() => setIsBackendModalOpen(true)}
        activeLectureCount={summaryStats.currentDetected}
      />

      {/* Main Workspace with Sidebar & Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          userRole={currentUser.role}
          isBackendOnline={backendStatus.online}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={summaryStats}
              lectures={lectures}
              classrooms={classrooms}
              userRole={currentUser.role}
              onNavigateToComparison={handleNavigateToComparison}
              onNavigateToCCTV={handleNavigateToCCTV}
            />
          )}

          {currentTab === 'cctv' && (
            <CCTVMonitoringView
              cameras={cameras}
              classrooms={classrooms}
              lectures={lectures}
              onSaveLecture={handleSaveLecture}
              onSaveCamera={handleSaveCamera}
              backendStatus={backendStatus}
              onRefreshBackend={probeBackend}
            />
          )}

          {currentTab === 'comparison' && (
            <LectureComparisonView
              lectures={lectures}
              onSelectLecture={(id) => setComparisonTargetId(id)}
            />
          )}

          {currentTab === 'lectures' && (
            <LectureManagementView
              lectures={lectures}
              classrooms={classrooms}
              cameras={cameras}
              userRole={currentUser.role}
              onSaveLecture={handleSaveLecture}
              onNavigateToComparison={handleNavigateToComparison}
            />
          )}

          {currentTab === 'reports' && (
            <AnalyticsReportsView
              lectures={lectures}
              classrooms={classrooms}
              stats={summaryStats}
              userRole={currentUser.role}
            />
          )}

          {currentTab === 'classrooms' && (
            <ClassroomsAndCamerasView
              classrooms={classrooms}
              cameras={cameras}
              onSaveClassroom={handleSaveClassroom}
              onSaveCamera={handleSaveCamera}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              backendStatus={backendStatus}
              onRefreshBackend={probeBackend}
              onResetData={handleResetData}
            />
          )}
        </main>
      </div>

      {/* Backend Diagnostics Modal */}
      <BackendInfoModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        backendStatus={backendStatus}
        onProbeBackend={probeBackend}
      />
    </div>
  );
}

export default App;
