/**
 * 100% Offline Audio Engine for Clinic Waiting Room TV Screen
 * Zero-CDN Policy: Never calls cloud TTS or external CDNs.
 *
 * 3-Tier Resiliency:
 *  - Tier 1: Local WAV audio assets (/audio/chime.wav, /audio/num_{x}.wav, /audio/intro.wav, /audio/outro.wav)
 *  - Tier 2: Browser SpeechSynthesis (native offline Arabic voice in Edge/Chrome/WebView2)
 *  - Tier 3: Web Audio API synthesized harmonic bell chime
 *
 * Deduplication: Monotonic callSequence tracking prevents replay stutters during network reconnects.
 */
export class OfflineAudioEngine {
    static initAudioContext() {
        if (typeof window === 'undefined')
            return;
        try {
            if (!this.audioContext) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.audioContext = new AudioCtx();
                }
            }
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => { });
            }
        }
        catch (e) {
            console.warn('AudioContext initialization deferred:', e);
        }
    }
    /**
     * Deduplicated announcement player.
     * If callSequence is older than or equal to last announced, announcement is safely skipped.
     */
    static async announcePatientCall(callSequence, queueNumber, roomName = 'غرفة الكشف') {
        if (callSequence > 0 && callSequence <= this.lastAnnouncedSequence) {
            console.log(`Skipping duplicate announcement for sequence ${callSequence}`);
            return false;
        }
        if (callSequence > 0) {
            this.lastAnnouncedSequence = callSequence;
        }
        if (this.isPlaying) {
            // Small debounce delay if another call is currently in flight
            await new Promise(r => setTimeout(r, 600));
        }
        this.isPlaying = true;
        try {
            this.initAudioContext();
            await this.execute3TierAnnouncement(queueNumber, roomName);
            return true;
        }
        catch (err) {
            console.error('Error during patient announcement:', err);
            // Emergency Tier 3 fallback
            this.playHarmonicChime();
            return false;
        }
        finally {
            this.isPlaying = false;
        }
    }
    static async execute3TierAnnouncement(queueNumber, roomName) {
        // 1. Play Chime
        try {
            const chimeAudio = new Audio('/audio/chime.wav');
            await chimeAudio.play();
            await new Promise(r => setTimeout(r, 1300));
        }
        catch (e) {
            console.warn('Tier 1 chime WAV failed or blocked, falling back to Web Audio Chime:', e);
            this.playHarmonicChime();
            await new Promise(r => setTimeout(r, 1200));
        }
        // 2. Play Number & Room announcement
        let speechHandled = false;
        // Tier 2: Offline Browser SpeechSynthesis
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel(); // Clear any ongoing speech
                const text = `كشف رقم ${queueNumber}. تفضل بالدخول إلى ${roomName || 'عيادة الطبيب'}`;
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'ar-EG';
                utterance.rate = 0.88;
                utterance.pitch = 1.0;
                const voices = window.speechSynthesis.getVoices();
                const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
                if (arabicVoice) {
                    utterance.voice = arabicVoice;
                }
                const speakPromise = new Promise((resolve) => {
                    utterance.onend = () => resolve();
                    utterance.onerror = () => resolve();
                    // Safety timeout in case speech synth hangs
                    setTimeout(() => resolve(), 4500);
                });
                window.speechSynthesis.speak(utterance);
                await speakPromise;
                speechHandled = true;
            }
            catch (speechErr) {
                console.warn('SpeechSynthesis tier failed:', speechErr);
            }
        }
        // Tier 1 fallback: If SpeechSynthesis not available or failed, play bundled number WAV if available
        if (!speechHandled && queueNumber >= 1 && queueNumber <= 99) {
            try {
                const numAudio = new Audio(`/audio/num_${queueNumber}.wav`);
                await numAudio.play();
                await new Promise(r => setTimeout(r, 900));
                const outroAudio = new Audio('/audio/outro.wav');
                await outroAudio.play();
                await new Promise(r => setTimeout(r, 700));
            }
            catch (wavErr) {
                console.warn('WAV sequence failed:', wavErr);
            }
        }
    }
    /**
     * Tier 3: Pure Web Audio API synthesized hospital harmonic bell chime
     */
    static playHarmonicChime() {
        if (typeof window === 'undefined')
            return;
        this.initAudioContext();
        if (!this.audioContext)
            return;
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            // Note 1: C5 (523.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now);
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.8);
            // Note 2: E5 (659.25 Hz) with 200ms offset
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.22);
            gain2.gain.setValueAtTime(0.35, now + 0.22);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.22);
            osc2.stop(now + 1.2);
            // Note 3: G5 (783.99 Hz) with 450ms offset
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(783.99, now + 0.45);
            gain3.gain.setValueAtTime(0.3, now + 0.45);
            gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.start(now + 0.45);
            osc3.stop(now + 1.4);
        }
        catch (e) {
            console.error('Harmonic chime synthesis failed:', e);
        }
    }
}
OfflineAudioEngine.audioContext = null;
OfflineAudioEngine.lastAnnouncedSequence = 0;
OfflineAudioEngine.isPlaying = false;
