import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Volume2, Maximize, Play } from 'lucide-react';
import { OfflineAudioEngine } from '../../lib/offlineAudio';
export function TvAudioOverlay({ onDismiss }) {
    const handleActivate = () => {
        // 1. Resume / Init AudioContext
        OfflineAudioEngine.initAudioContext();
        OfflineAudioEngine.playHarmonicChime();
        // 2. Request Fullscreen if supported
        try {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => { });
            }
        }
        catch (e) {
            console.warn('Fullscreen request deferred:', e);
        }
        onDismiss();
    };
    return (_jsx("div", { onClick: handleActivate, className: "fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-lg cursor-pointer select-none transition-all duration-300", children: _jsxs("div", { className: "max-w-lg w-full p-8 rounded-3xl bg-slate-900 border-2 border-sky-500/50 text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200", children: [_jsx("div", { className: "w-24 h-24 mx-auto rounded-full bg-sky-500/20 border-2 border-sky-400 text-sky-400 flex items-center justify-center shadow-lg animate-bounce", children: _jsx(Volume2, { className: "w-12 h-12" }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-3xl font-extrabold text-white", children: "\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0646\u062F\u0627\u0621 \u0627\u0644\u0635\u0648\u062A\u064A \u0648\u0645\u0644\u0621 \u0627\u0644\u0634\u0627\u0634\u0629" }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: "\u0648\u0641\u0642\u0627\u064B \u0644\u0633\u064A\u0627\u0633\u0627\u062A \u0645\u062A\u0635\u0641\u062D\u0627\u062A \u0627\u0644\u0648\u064A\u0628 \u0627\u0644\u062D\u062F\u064A\u062B\u0629\u060C \u064A\u0644\u0632\u0645 \u0627\u0644\u0646\u0642\u0631 \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0644\u062A\u0635\u0631\u064A\u062D \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0635\u0648\u062A \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0639\u0646\u062F \u0646\u062F\u0627\u0621 \u0627\u0644\u0645\u0631\u0636\u0649 \u0641\u064A \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631." })] }), _jsx("div", { className: "pt-2", children: _jsxs("div", { className: "inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-black text-lg shadow-xl hover:brightness-110", children: [_jsx(Play, { className: "w-6 h-6 fill-current" }), _jsx("span", { children: "\u0627\u0646\u0642\u0631 \u0644\u0644\u0628\u062F\u0621 \u0627\u0644\u0641\u0648\u0631\u064A" }), _jsx(Maximize, { className: "w-5 h-5 mr-1" })] }) }), _jsx("p", { className: "text-xs text-slate-500", children: "* \u0641\u064A \u062A\u0637\u0628\u064A\u0642 \u0633\u0637\u062D \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u062F\u0627\u0626\u0645 (WPF) \u064A\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0647\u0630\u0647 \u0627\u0644\u062E\u0637\u0648\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0628\u0627\u0644\u0643\u0627\u0645\u0644." })] }) }));
}
