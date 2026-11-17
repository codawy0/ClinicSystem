import { Volume2, Maximize, Play } from 'lucide-react';
import { OfflineAudioEngine } from '../../lib/offlineAudio';

interface TvAudioOverlayProps {
  onDismiss: () => void;
}

export function TvAudioOverlay({ onDismiss }: TvAudioOverlayProps) {
  const handleActivate = () => {
    // 1. Resume / Init AudioContext
    OfflineAudioEngine.initAudioContext();
    OfflineAudioEngine.playHarmonicChime();

    // 2. Request Fullscreen if supported
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {
      console.warn('Fullscreen request deferred:', e);
    }

    onDismiss();
  };

  return (
    <div
      onClick={handleActivate}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-lg cursor-pointer select-none transition-all duration-300"
    >
      <div className="max-w-lg w-full p-8 rounded-3xl bg-slate-900 border-2 border-sky-500/50 text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-24 h-24 mx-auto rounded-full bg-sky-500/20 border-2 border-sky-400 text-sky-400 flex items-center justify-center shadow-lg animate-bounce">
          <Volume2 className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-white">تفعيل النداء الصوتي وملء الشاشة</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            وفقاً لسياسات متصفحات الويب الحديثة، يلزم النقر مرة واحدة لتصريح تشغيل الصوت تلقائياً عند نداء المرضى في صالة الانتظار.
          </p>
        </div>

        <div className="pt-2">
          <div className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-black text-lg shadow-xl hover:brightness-110">
            <Play className="w-6 h-6 fill-current" />
            <span>انقر للبدء الفوري</span>
            <Maximize className="w-5 h-5 mr-1" />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          * في تطبيق سطح المكتب الدائم (WPF) يتم تجاوز هذه الخطوة تلقائياً بالكامل.
        </p>
      </div>
    </div>
  );
}
