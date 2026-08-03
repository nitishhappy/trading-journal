// ===================== audio.js — Web Audio API Synthesizer =====================
// Crystal-clear synthesized alert tones with zero external file dependencies.
// Works 100% offline and cross-browser.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Unlock audio on first user touch/click interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

/**
 * Play a synthesized sound tone
 * @param {string} type - 'chime' | 'radar' | 'bell' | 'beep' | 'special'
 * @param {number} volume - 0.0 to 1.0
 */
export function playSynthesizedSound(type = 'chime', volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const clampedVol = Math.max(0, Math.min(1, Number(volume) || 0.8));
    const now = ctx.currentTime;

    switch (type) {
      case 'chime': {
        // Melodic dual-tone chime (523.25Hz -> 783.99Hz)
        [523.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.45, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.65);
        });
        break;
      }

      case 'radar': {
        // Soft deep sonar ping with harmonic resonance
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.5);

        gain.gain.setValueAtTime(clampedVol * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.75);
        break;
      }

      case 'bell': {
        // Resonant metallic bell tone with harmonic overtones
        [440, 880, 1320].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          const factor = 1 / (i + 1);
          gain.gain.setValueAtTime(clampedVol * 0.35 * factor, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (0.8 / (i * 0.5 + 1)));

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.85);
        });
        break;
      }

      case 'beep': {
        // Crisp dual digital terminal beeps
        [0, 0.12].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(987.77, now + offset); // B5

          gain.gain.setValueAtTime(clampedVol * 0.18, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + 0.08);
        });
        break;
      }

      case 'special':
      default: {
        // Rich celebratory 4-note ascending chord for Special Times (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);

          gain.gain.setValueAtTime(0, now + idx * 0.14);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.5, now + idx * 0.14 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.85);
        });
        break;
      }
    }
  } catch (err) {
    console.warn("Audio play error:", err);
  }
}
