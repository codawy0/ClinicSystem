import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Stethoscope, Clock } from 'lucide-react';
import { useQueueHub } from '../hooks/useQueueHub';
import { OfflineAudioEngine } from '../lib/offlineAudio';
import { api } from '../lib/api';
import { TvPrivacyMode, PatientCalledPayload, DoctorBreakPayload } from '../types';
import { TvActiveCallHero } from '../components/tv/TvActiveCallHero';
import { TvNextWaitingList } from '../components/tv/TvNextWaitingList';
import { TvDoctorBreakBanner } from '../components/tv/TvDoctorBreakBanner';
import { TvAudioOverlay } from '../components/tv/TvAudioOverlay';

interface WaitingQueueItem {
  queueNumber: number;
  patientName: string;
  isUrgent?: boolean;
}

export function TvQueueScreen() {
  // Device token from query params
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [showAudioOverlay, setShowAudioOverlay] = useState<boolean>(true);

  // Clinic & Doctor state
  const [clinicName, setClinicName] = useState<string>('عيادة الاستشاري التخصصية');
  const [doctorName, setDoctorName] = useState<string>('د. أحمد عبد الرحمن');
  const [roomName, setRoomName] = useState<string>('عيادة 1');
  const [privacyMode, setPrivacyMode] = useState<TvPrivacyMode>('FirstNameAndInitial');
  const [isDoctorOnBreak, setIsDoctorOnBreak] = useState<boolean>(false);
  const [breakMessage, setBreakMessage] = useState<string>('');

  // Active call state
  const [currentCall, setCurrentCall] = useState<{
    queueNumber: number | null;
    patientName: string | null;
    roomName: string;
    doctorName: string;
  }>({
    queueNumber: null,
    patientName: null,
    roomName: 'عيادة 1',
    doctorName: 'د. أحمد عبد الرحمن',
  });

  // Next waiting patients
  const [waitingList, setWaitingList] = useState<WaitingQueueItem[]>([]);

  // Clock state
  const [currentTime, setCurrentTime] = useState<string>('');

  // Track sequence for deduplication
  const lastAnnouncedSeqRef = useRef<number>(0);

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
      setCurrentTime(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial TV state from API
  const fetchTvState = async () => {
    if (!deviceToken) return;
    try {
      const state = await api.get<any>('/queue/tv-state', { token: deviceToken });

      if (state) {
        if (state.clinicName) setClinicName(state.clinicName);
        if (state.doctorName) setDoctorName(state.doctorName);
        if (state.roomName) setRoomName(state.roomName);
        if (state.privacyMode) setPrivacyMode(state.privacyMode);
        setIsDoctorOnBreak(Boolean(state.isDoctorOnBreak));
        if (state.breakMessage) setBreakMessage(state.breakMessage);

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
          setWaitingList(
            waiting.map((w: any) => ({
              queueNumber: w.queueNumber,
              patientName: w.displayName || w.patientName || '',
              isUrgent: Boolean(w.isUrgent),
            }))
          );
        }
      }
    } catch (e) {
      console.warn('Initial TV state fetch failed (will rely on SignalR):', e);
    }
  };

  useEffect(() => {
    if (deviceToken) {
      fetchTvState();
    }
  }, [deviceToken]);

  // Handle SignalR PatientCalled
  const handlePatientCalled = async (payload: PatientCalledPayload) => {
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
    await OfflineAudioEngine.announcePatientCall(
      payload.callSequence,
      payload.queueNumber,
      payload.roomName || roomName
    );
  };

  // Handle SignalR DoctorBreakToggled
  const handleDoctorBreakToggled = (payload: DoctorBreakPayload) => {
    setIsDoctorOnBreak(payload.isDoctorOnBreak);
    if (payload.message) setBreakMessage(payload.message);
  };

  // SignalR connection
  const { isConnected } = useQueueHub({
    tvDeviceToken: deviceToken,
    onPatientCalled: handlePatientCalled,
    onDoctorBreakToggled: handleDoctorBreakToggled,
    onResyncRequired: fetchTvState,
    enabled: Boolean(deviceToken),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden relative">
      {/* Autoplay & Fullscreen unlock overlay */}
      {showAudioOverlay && (
        <TvAudioOverlay onDismiss={() => setShowAudioOverlay(false)} />
      )}

      {/* Top Clinic Header & Clock */}
      <header className="px-8 py-5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-slate-950 shadow-lg shadow-sky-500/20">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white">{clinicName}</h1>
            <p className="text-sm font-semibold text-sky-400 mt-0.5">{doctorName}</p>
          </div>
        </div>

        {/* LAN Connection & Clock */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">متصل مباشر (LAN)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="text-rose-400 font-bold">جاري إعادة الاتصال...</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 px-6 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xl font-mono font-black text-sky-200 shadow-inner">
            <Clock className="w-5 h-5 text-sky-400" />
            <span dir="ltr">{currentTime}</span>
          </div>
        </div>
      </header>

      {/* Doctor Break Banner */}
      <TvDoctorBreakBanner isOnBreak={isDoctorOnBreak} message={breakMessage} />

      {/* Main 10-Foot Content Canvas */}
      <main className="flex-1 p-8 flex flex-col lg:flex-row gap-8 items-stretch overflow-hidden">
        {/* Active Hero Call */}
        <TvActiveCallHero
          queueNumber={currentCall.queueNumber}
          patientName={currentCall.patientName}
          roomName={currentCall.roomName}
          doctorName={currentCall.doctorName}
          privacyMode={privacyMode}
        />

        {/* Side Waiting List */}
        <TvNextWaitingList
          waitingPatients={waitingList}
          privacyMode={privacyMode}
        />
      </main>

      {/* Bottom Footer Ticker */}
      <footer className="px-8 py-3 bg-slate-900/60 border-t border-slate-800 text-center text-xs text-slate-500 font-medium flex items-center justify-between">
        <span>نظام الانتظار الذكي المطور • شاشة صالة الانتظار التفاعلية</span>
        <span className="text-[11px] text-slate-400">
          وضع الخصوصية: {privacyMode === 'FirstNameAndInitial' ? 'اسم أول وحرف' : privacyMode === 'QueueNumberOnly' ? 'أرقام فقط' : 'اسم كامل'}
        </span>
      </footer>
    </div>
  );
}
