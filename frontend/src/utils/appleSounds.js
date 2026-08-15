/**
 * Apple iOS Tactile Audio Engine (100% Web Audio API Synthesis - 0 External Files)
 * Generates authentic Cupertino haptic feedback sounds & ringtone sequences.
 */

let audioCtx = null;
let ringtoneInterval = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

/**
 * iOS Message Sent Sound (Crisp Swoosh & Pop)
 */
export const playSentSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Pop Oscillator
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
};

/**
 * iOS 3D Touch Peek & Pop (Low resonant click & haptic thud)
 */
export const playPopSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
};

/**
 * iOS Subtle Button / Key Click Tap
 */
export const playClickSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.02);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.025);
};

/**
 * iOS Lock / Vault Sound
 */
export const playLockSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
};

/**
 * iOS Incoming Call Ringtone Synthesis (Melodic 3-Chime Sequence Loop)
 */
export const startIncomingCallRingtone = () => {
  stopIncomingCallRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playChimeSequence = () => {
    const notes = [
      { freq: 880, time: 0, dur: 0.15 },
      { freq: 1046.5, time: 0.18, dur: 0.15 },
      { freq: 1318.5, time: 0.36, dur: 0.25 },
      { freq: 1046.5, time: 0.65, dur: 0.15 },
      { freq: 1318.5, time: 0.83, dur: 0.35 },
    ];

    const startT = ctx.currentTime;
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, startT + n.time);

      gain.gain.setValueAtTime(0, startT + n.time);
      gain.gain.linearRampToValueAtTime(0.2, startT + n.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + n.time + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startT + n.time);
      osc.stop(startT + n.time + n.dur);
    });
  };

  playChimeSequence();
  ringtoneInterval = setInterval(playChimeSequence, 2400);
};

export const stopIncomingCallRingtone = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};
