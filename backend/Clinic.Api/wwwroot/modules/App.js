import { jsx as _jsx } from "react/jsx-runtime";
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
    const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
    // TV Queue Screen (Independent public / unattended screen)
    if (currentPath.startsWith('/tv-queue')) {
        return _jsx(TvQueueScreen, {});
    }
    // Doctor Cockpit Screen
    if (currentPath.startsWith('/doctor')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        const user = authStorage.getUser();
        if (user?.role !== 'Doctor' && user?.role !== 'AssistantDoctor' && user?.role !== 'Admin') {
            window.history.replaceState(null, '', '/reception');
            return _jsx(ReceptionCockpit, {});
        }
        return _jsx(DoctorCockpit, {});
    }
    // Nursing Prep Screen
    if (currentPath.startsWith('/nursing')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        return _jsx(NursePrepScreen, {});
    }
    // Treasury Page
    if (currentPath.startsWith('/treasury')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        const user = authStorage.getUser();
        if (user?.role !== 'Receptionist' &&
            user?.role !== 'Doctor' &&
            user?.role !== 'AssistantDoctor' &&
            user?.role !== 'Admin') {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        return _jsx(TreasuryPage, {});
    }
    // Analytics Page
    if (currentPath.startsWith('/analytics')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        const user = authStorage.getUser();
        if (user?.role !== 'Doctor' && user?.role !== 'AssistantDoctor' && user?.role !== 'Admin') {
            window.history.replaceState(null, '', '/reception');
            return _jsx(ReceptionCockpit, {});
        }
        return _jsx(AnalyticsPage, {});
    }
    // Settings Page
    if (currentPath.startsWith('/settings')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        const user = authStorage.getUser();
        if (user?.role !== 'Doctor' && user?.role !== 'Admin') {
            window.history.replaceState(null, '', '/reception');
            return _jsx(ReceptionCockpit, {});
        }
        return _jsx(SettingsPage, {});
    }
    // Reception Cockpit
    if (currentPath.startsWith('/reception')) {
        const token = authStorage.getToken();
        if (!token) {
            window.history.replaceState(null, '', '/login');
            return _jsx(LoginScreen, {});
        }
        return _jsx(ReceptionCockpit, {});
    }
    // Login Screen
    if (currentPath.startsWith('/login')) {
        return _jsx(LoginScreen, {});
    }
    // Default root fallback
    const token = authStorage.getToken();
    if (token) {
        const user = authStorage.getUser();
        if (user?.role === 'Doctor' || user?.role === 'AssistantDoctor') {
            return _jsx(DoctorCockpit, {});
        }
        if (user?.role === 'Nurse') {
            return _jsx(NursePrepScreen, {});
        }
        return _jsx(ReceptionCockpit, {});
    }
    return _jsx(LoginScreen, {});
}
export default App;
