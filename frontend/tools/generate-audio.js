/**
 * Offline Audio Generator
 * Generates lightweight, pristine 16-bit PCM WAV audio files for clinic waiting room announcements.
 * Zero external dependencies. Uses pure Node.js Buffer and mathematical wave synthesis.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.resolve(__dirname, '../public/audio');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function createWavBuffer(samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF identifier
  buffer.write('RIFF', 0);
  // File length minus 8
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  // RIFF type
  buffer.write('WAVE', 8);

  // format chunk identifier
  buffer.write('fmt ', 12);
  // format chunk length
  buffer.writeUInt32LE(16, 16);
  // sample format (1 = PCM)
  buffer.writeUInt16LE(1, 20);
  // channel count (1 = mono)
  buffer.writeUInt16LE(1, 22);
  // sample rate
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  // byte rate (sample rate * block align)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  // block align (channel count * bytes per sample)
  buffer.writeUInt16LE(2, 32);
  // bits per sample
  buffer.writeUInt16LE(16, 34);

  // data chunk identifier
  buffer.write('data', 36);
  // data chunk length
  buffer.writeUInt32LE(numSamples * 2, 40);

  // write 16-bit PCM samples
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }

  return buffer;
}

// Generate two-tone hospital/airport style chime (C5 -> E5 -> G5)
function generateChime() {
  const duration = 1.4;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;

    // First tone (523.25 Hz - C5) 0.0s to 0.7s
    if (t < 0.7) {
      const env = Math.exp(-4 * t);
      s += 0.5 * Math.sin(2 * Math.PI * 523.25 * t) * env;
      s += 0.2 * Math.sin(2 * Math.PI * 1046.5 * t) * env; // harmonic
    }

    // Second tone (659.25 Hz - E5) 0.25s to 1.4s
    if (t >= 0.25) {
      const t2 = t - 0.25;
      const env = Math.exp(-3.5 * t2);
      s += 0.6 * Math.sin(2 * Math.PI * 659.25 * t) * env;
      s += 0.25 * Math.sin(2 * Math.PI * 1318.5 * t) * env;
    }

    // Third soft tone (783.99 Hz - G5) 0.5s to 1.4s
    if (t >= 0.5) {
      const t3 = t - 0.5;
      const env = Math.exp(-4 * t3);
      s += 0.4 * Math.sin(2 * Math.PI * 783.99 * t) * env;
    }

    samples[i] = s * 0.7;
  }

  return samples;
}

// Generate intro cue (tri-tone upward arpeggio)
function generateIntro() {
  const duration = 0.9;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  const notes = [440, 554.37, 659.25]; // A4, C#5, E5
  const noteDuration = 0.25;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDuration));
    const noteTime = t - noteIdx * noteDuration;
    const freq = notes[noteIdx];
    const env = Math.exp(-5 * noteTime);
    samples[i] = 0.6 * Math.sin(2 * Math.PI * freq * t) * env;
  }

  return samples;
}

// Generate outro cue (soft resolving downward chord)
function generateOutro() {
  const duration = 0.8;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  const notes = [659.25, 523.25]; // E5 -> C5
  const noteDuration = 0.35;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDuration));
    const noteTime = t - noteIdx * noteDuration;
    const freq = notes[noteIdx];
    const env = Math.exp(-4 * noteTime);
    samples[i] = 0.5 * Math.sin(2 * Math.PI * freq * t) * env;
  }

  return samples;
}

// Generate spoken-like harmonic number acoustic signature for numbers 1 to 99
function generateNumberAudio(num) {
  const duration = 0.75;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  // Base fundamental frequencies mapped rhythmically
  const baseFreq = 260 + (num % 20) * 18;
  const secondFreq = baseFreq * 1.5;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Bell / marimba-like envelope
    const env = Math.sin(Math.PI * (t / duration)) * Math.exp(-2.5 * t);
    const s = 0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
              0.3 * Math.sin(2 * Math.PI * secondFreq * t) +
              0.15 * Math.sin(2 * Math.PI * baseFreq * 2 * t);
    samples[i] = s * env * 0.7;
  }

  return samples;
}

console.log('Generating offline audio assets in', OUTPUT_DIR);

// 1. Chime
fs.writeFileSync(path.join(OUTPUT_DIR, 'chime.wav'), createWavBuffer(generateChime()));
console.log('Created chime.wav');

// 2. Intro
fs.writeFileSync(path.join(OUTPUT_DIR, 'intro.wav'), createWavBuffer(generateIntro()));
console.log('Created intro.wav');

// 3. Outro
fs.writeFileSync(path.join(OUTPUT_DIR, 'outro.wav'), createWavBuffer(generateOutro()));
console.log('Created outro.wav');

// 4. Numbers 1..99
for (let n = 1; n <= 99; n++) {
  fs.writeFileSync(path.join(OUTPUT_DIR, `num_${n}.wav`), createWavBuffer(generateNumberAudio(n)));
}
console.log('Created num_1.wav through num_99.wav (99 audio clips)');
console.log('Offline audio asset generation complete!');
