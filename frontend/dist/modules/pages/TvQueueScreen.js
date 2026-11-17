import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Stethoscope, Clock } from 'lucide-react';
import { useQueueHub } from '../hooks/useQueueHub';
import { OfflineAudioEngine } from '../lib/offlineAudio';
import { api } from '../lib/api';
import { TvActiveCallHero } from '../components/tv/TvActiveCallHero';
import { TvNextWaitingList } from '../components/tv/TvNextWaitingList';
import { TvDoctorBreakBanner } from '../components/tv/TvDoctorBreakBanner';
import { TvAudioOverlay } from '../components/tv/TvAudioOverlay';
export function TvQueueScreen() {
    // Device token from query params
    const [deviceToken, setDeviceToken] = useState('');
    const [showAudioOverlay, setShowAudioOverlay] = useState(true);
    // Clinic & Doctor state
    const [clinicName, setClinicName] = useState('عيادة الاستشاري التخصصية');
    const [doctorName, setDoctorName] = useState('د. أحمد عبد الرحمن');
    const [roomName, setRoomName] = useState('عيادة 1');
    const [privacyMode, setPrivacyMode] = useState('FirstNameAndInitial');
    const [isDoctorOnBreak, setIsDoctorOnBreak] = useState(false);
    const [breakMessage, setBreakMessage] = useState('');
    // Active call state
    const [currentCall, setCurrentCall] = useState({
        queueNumber: null,
        patientName: null,
        roomName: 'عيادة 1',
        doctorName: 'د. أحمد عبد الرحمن',
    });
    // Next waiting patients
    const [waitingList, setWaitingList] = useState([]);
    // Clock state
    const [currentTime, setCurrentTime] = useState('');
    // Track sequence for deduplication
    const lastAnnouncedSeqRef = useRef(0);
    // Read query params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token') || params.get('tvToken') || 'dev-tv-token';
        setDeviceToken(token);
    }, []);
    // Digital clock (Egypt Standard Time)
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);
    // Fetch initial TV state from API
    const fetchTvState = async () => {
        if (!deviceToken)
            return;
        try {
            const state = await api.get('/queue/tv-state', { token: deviceToken });
            if (state) {
                if (state.clinicName)
                    setClinicName(state.clinicName);
                if (state.doctorName)
                    setDoctorName(state.doctorName);
                if (state.roomName)
                    setRoomName(state.roomName);
                if (state.privacyMode)
                    setPrivacyMode(state.privacyMode);
                setIsDoctorOnBreak(Boolean(state.isDoctorOnBreak));
                if (state.breakMessage)
                    setBreakMessage(state.breakMessage);
                const current = state.currentCalled || state.currentCall;
                if (current) {
                    setCurrentCall({
                        queueNumber: current.queueNumber,
                        patientName: current.displayName || current.patientName || '',
                        roomName: current.roomName || roomName,
                        doctorName: current.doctorName || doctorName,
                    });
                }
                const waiting = state.upcomingWaiting || state.waitingPatients;
                if (waiting && Array.isArray(waiting)) {
                    setWaitingList(waiting.map((w) => ({
                        queueNumber: w.queueNumber,
                        patientName: w.displayName || w.patientName || '',
                        isUrgent: Boolean(w.isUrgent),
                    })));
                }
            }
        }
        catch (e) {
            console.warn('Initial TV state fetch failed (will rely on SignalR):', e);
        }
    };
    useEffect(() => {
        if (deviceToken) {
            fetchTvState();
        }
    }, [deviceToken]);
    // Handle SignalR PatientCalled
    const handlePatientCalled = async (payload) => {
        if (payload.callSequence <= lastAnnouncedSeqRef.current) {
            console.log('Skipping duplicate patient call sequence:', payload.callSequence);
            return;
        }
        lastAnnouncedSeqRef.current = payload.callSequence;
        // Update active hero display
        setCurrentCall({
            queueNumber: payload.queueNumber,
            patientName: payload.displayName,
            roomName: payload.roomName || roomName,
            doctorName: payload.doctorName || doctorName,
        });
        // Remove from waiting list
        setWaitingList((prev) => prev.filter((p) => p.queueNumber !== payload.queueNumber));
        // Execute 3-tier announcement
        await OfflineAudioEngine.announcePatientCall(payload.callSequence, payload.queueNumber, payload.roomName || roomName);
    };
    // Handle SignalR DoctorBreakToggled
    const handleDoctorBreakToggled = (payload) => {
        setIsDoctorOnBreak(payload.isDoctorOnBreak);
        if (payload.message)
            setBreakMessage(payload.message);
    };
    // SignalR connection
    const { isConnected } = useQueueHub({
        tvDeviceToken: deviceToken,
        onPatientCalled: handlePatientCalled,
        onDoctorBreakToggled: handleDoctorBreakToggled,
        onResyncRequired: fetchTvState,
        enabled: Boolean(deviceToken),
    });
    return (_jsxs("div", { className: "min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden relative", children: [showAudioOverlay && (_jsx(TvAudioOverlay, { onDismiss: () => setShowAudioOverlay(false) })), _jsxs("header", { className: "px-8 py-5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-10", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "p-3 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-slate-950 shadow-lg shadow-sky-500/20", children: _jsx(Stethoscope, { className: "w-8 h-8" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-black tracking-wide text-white", children: clinicName }), _jsx("p", { className: "text-sm font-semibold text-sky-400 mt-0.5", children: doctorName })] })] }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: "flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs", children: isConnected ? (_jsxs(_Fragment, { children: [_jsx(Wifi, { className: "w-4 h-4 text-emerald-400" }), _jsx("span", { className: "text-emerald-400 font-bold", children: "\u0645\u062A\u0635\u0644 \u0645\u0628\u0627\u0634\u0631 (LAN)" })] })) : (_jsxs(_Fragment, { children: [_jsx(WifiOff, { className: "w-4 h-4 text-rose-400 animate-pulse" }), _jsx("span", { className: "text-rose-400 font-bold", children: "\u062C\u0627\u0631\u064A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644..." })] })) }), _jsxs("div", { className: "flex items-center gap-2.5 px-6 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xl font-mono font-black text-sky-200 shadow-inner", children: [_jsx(Clock, { className: "w-5 h-5 text-sky-400" }), _jsx("span", { dir: "ltr", children: currentTime })] })] })] }), _jsx(TvDoctorBreakBanner, { isOnBreak: isDoctorOnBreak, message: breakMessage }), _jsxs("main", { className: "flex-1 p-8 flex flex-col lg:flex-row gap-8 items-stretch overflow-hidden", children: [_jsx(TvActiveCallHero, { queueNumber: currentCall.queueNumber, patientName: currentCall.patientName, roomName: currentCall.roomName, doctorName: currentCall.doctorName, privacyMode: privacyMode }), _jsx(TvNextWaitingList, { waitingPatients: waitingList, privacyMode: privacyMode })] }), _jsxs("footer", { className: "px-8 py-3 bg-slate-900/60 border-t border-slate-800 text-center text-xs text-slate-500 font-medium flex items-center justify-between", children: [_jsx("span", { children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0645\u0637\u0648\u0631 \u2022 \u0634\u0627\u0634\u0629 \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A\u0629" }), _jsxs("span", { className: "text-[11px] text-slate-400", children: ["\u0648\u0636\u0639 \u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629: ", privacyMode === 'FirstNameAndInitial' ? 'اسم أول وحرف' : privacyMode === 'QueueNumberOnly' ? 'أرقام فقط' : 'اسم كامل'] })] })] }));
}
