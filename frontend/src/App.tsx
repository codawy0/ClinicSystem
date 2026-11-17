import { useState, useEffect } from 'react';
import { LoginScreen } from './pages/LoginScreen';
import { ReceptionCockpit } from './pages/ReceptionCockpit';
import { TvQueueScreen } from './pages/TvQueueScreen';
import { NursePrepScreen } from './pages/NursePrepScreen';
import { DoctorCockpit } from './pages/DoctorCockpit';
import { TreasuryPage } from './pages/TreasuryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { authStorage } from './lib/api';

export function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // TV Queue Screen (Independent public / unattended screen)
  if (currentPath.startsWith('/tv-queue')) {
    return <TvQueueScreen />;
  }

  // Doctor Cockpit Screen
  if (currentPath.startsWith('/doctor')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    const user = authStorage.getUser();
    if (user?.role !== 'Doctor' && user?.role !== 'AssistantDoctor' && user?.role !== 'Admin') {
      window.history.replaceState(null, '', '/reception');
      return <ReceptionCockpit />;
    }
    return <DoctorCockpit />;
  }

  // Nursing Prep Screen
  if (currentPath.startsWith('/nursing')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    return <NursePrepScreen />;
  }

  // Treasury Page
  if (currentPath.startsWith('/treasury')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    const user = authStorage.getUser();
    if (
      user?.role !== 'Receptionist' &&
      user?.role !== 'Doctor' &&
      user?.role !== 'AssistantDoctor' &&
      user?.role !== 'Admin'
    ) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    return <TreasuryPage />;
  }

  // Analytics Page
  if (currentPath.startsWith('/analytics')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    const user = authStorage.getUser();
    if (user?.role !== 'Doctor' && user?.role !== 'AssistantDoctor' && user?.role !== 'Admin') {
      window.history.replaceState(null, '', '/reception');
      return <ReceptionCockpit />;
    }
    return <AnalyticsPage />;
  }

  // Settings Page
  if (currentPath.startsWith('/settings')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    const user = authStorage.getUser();
    if (user?.role !== 'Doctor' && user?.role !== 'Admin') {
      window.history.replaceState(null, '', '/reception');
      return <ReceptionCockpit />;
    }
    return <SettingsPage />;
  }

  // Reception Cockpit
  if (currentPath.startsWith('/reception')) {
    const token = authStorage.getToken();
    if (!token) {
      window.history.replaceState(null, '', '/login');
      return <LoginScreen />;
    }
    return <ReceptionCockpit />;
  }

  // Login Screen
  if (currentPath.startsWith('/login')) {
    return <LoginScreen />;
  }

  // Default root fallback
  const token = authStorage.getToken();
  if (token) {
    const user = authStorage.getUser();
    if (user?.role === 'Doctor' || user?.role === 'AssistantDoctor') {
      return <DoctorCockpit />;
    }
    if (user?.role === 'Nurse') {
      return <NursePrepScreen />;
    }
    return <ReceptionCockpit />;
  }

  return <LoginScreen />;
}

export default App;
