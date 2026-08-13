// ===================== audio.js — Web Audio API Synthesizer =====================
// Crystal-clear synthesized alert tones with zero external file dependencies.
// Works 100% offline and cross-browser.

let audioCtx = null;

export function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Unlock audio on first user touch/click interaction
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudioContext, { once: false });
  window.addEventListener('keydown', unlockAudioContext, { once: false });
  window.addEventListener('touchstart', unlockAudioContext, { once: false });
}

/**
 * Play a synthesized sound tone
 * @param {string} type - 'chime' | 'radar' | 'bell' | 'beep' | 'special'
 * @param {number} volume - 0.0 to 1.0
 */
// ===================== Silent Background Audio for Android Keep-Alive =====================
// Plays a near-silent looping audio track via an HTML5 <audio> element.
// Android Chrome treats any tab with active media playback as a high-priority
// "media player" process, preventing the Low Memory Killer from suspending or
// terminating the WebAPK. The Media Session API is also set so the Android
// lock-screen / notification tray shows "Trade Journal – Active" instead of
// a generic media notification.

let silentAudioEl = null;
let silentAudioPlaying = false;

// Minimal valid WAV file: 1 second of near-silence at 8kHz mono 8-bit.
// The single sample value 128 (0x80) is the DC midpoint for unsigned 8-bit
// PCM, producing no audible sound. Total size: 8044 bytes base64-encoded.
function createSilentWavBlob() {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const headerSize = 44;
  const dataSize = numSamples;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);        // SubChunk1Size (PCM)
  view.setUint16(20, 1, true);         // AudioFormat (PCM)
  view.setUint16(22, 1, true);         // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate, true); // ByteRate
  view.setUint16(32, 1, true);         // BlockAlign
  view.setUint16(34, 8, true);         // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Fill with silence (128 = DC midpoint for unsigned 8-bit PCM)
  const bytes = new Uint8Array(buffer, headerSize);
  bytes.fill(128);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Start playing silent audio in the background to keep Android from killing
 * the PWA process. Also registers a Media Session so the notification/lock
 * screen shows a friendly "Trade Journal – Active" label.
 */
export function startSilentAudio() {
  if (silentAudioPlaying && silentAudioEl) return;

  try {
    if (!silentAudioEl) {
      const blob = createSilentWavBlob();
      const url = URL.createObjectURL(blob);

      silentAudioEl = document.createElement('audio');
      silentAudioEl.id = 'keep-alive-silent-audio';
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.01; // Near-silent but non-zero so Android treats it as active media
      silentAudioEl.src = url;
      silentAudioEl.setAttribute('playsinline', '');
      silentAudioEl.setAttribute('webkit-playsinline', '');
      // Keep element in DOM so Android doesn't garbage-collect the media session
      document.body.appendChild(silentAudioEl);
    }

    const playPromise = silentAudioEl.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          silentAudioPlaying = true;
          setupMediaSession();
          console.log('[KeepAlive] Silent audio started');
        })
        .catch(err => {
          console.warn('[KeepAlive] Silent audio play failed (user gesture needed?):', err.message);
          silentAudioPlaying = false;
        });
    }
  } catch (err) {
    console.warn('[KeepAlive] Could not start silent audio:', err);
  }
}

/**
 * Stop the silent background audio and clear the Media Session.
 */
export function stopSilentAudio() {
  if (silentAudioEl) {
    silentAudioEl.pause();
    silentAudioEl.currentTime = 0;
    silentAudioPlaying = false;
    console.log('[KeepAlive] Silent audio stopped');
  }
  // Clear media session metadata
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

/**
 * Returns whether the silent keep-alive audio is currently playing.
 */
export function isSilentAudioPlaying() {
  return silentAudioPlaying;
}

/**
 * Set up the Media Session API so Android's notification tray / lock screen
 * shows a friendly label instead of a generic "media playing" notification.
 */
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Trade Journal – Active',
      artist: 'Keep Open Mode',
      album: 'Trade Journal',
    });
    navigator.mediaSession.playbackState = 'playing';

    // Prevent accidental pause from lock-screen controls
    navigator.mediaSession.setActionHandler('pause', () => {
      // Do nothing — user must disable via in-app toggle
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (silentAudioEl && silentAudioEl.paused) {
        silentAudioEl.play().catch(() => {});
      }
    });
    // Swallow other actions so they don't interfere
    ['seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'stop'].forEach(action => {
      try { navigator.mediaSession.setActionHandler(action, () => {}); } catch (e) {}
    });
  } catch (err) {
    console.warn('[KeepAlive] MediaSession setup failed:', err);
  }
}

// ===================== Synthesized Sound Tones =====================

export async function playSynthesizedSound(type = 'chime', volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("Could not resume audio context:", e);
      }
    }

    const clampedVol = Math.max(0.05, Math.min(1.0, Number(volume) || 0.8));
    const now = ctx.currentTime + 0.01;

    switch (type) {
      case 'chime': {
        // Melodic dual-tone chime (523.25Hz -> 783.99Hz)
        [523.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.5, now + idx * 0.12 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.65);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.7);
        });
        break;
      }

      case 'radar': {
        // Soft deep sonar ping with harmonic resonance
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.45);

        gain.gain.setValueAtTime(clampedVol * 0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

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
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.4 * factor, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (0.85 / (i * 0.5 + 1)));

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.9);
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

          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.22, now + offset + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.08);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + 0.09);
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
          osc.frequency.setValueAtTime(freq, now + idx * 0.13);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.13);
          gain.gain.linearRampToValueAtTime(clampedVol * 0.5, now + idx * 0.13 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.13 + 0.85);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.13);
          osc.stop(now + idx * 0.13 + 0.9);
        });
        break;
      }
    }
  } catch (err) {
    console.warn("Audio play error:", err);
  }
}

