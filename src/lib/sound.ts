// Notification sounds synthesized with the Web Audio API (no asset files).
//
// Browsers block audio until a user gesture, so we lazily create the
// AudioContext and resume it on the first pointer/keyboard interaction.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

// Unlock audio on the first user interaction (autoplay policy).
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** Play one or more simultaneous sine tones with a soft envelope. */
function tone(ctx: AudioContext, freqs: number[], start: number, dur: number, gainVal: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(gainVal, start + 0.02);
  gain.gain.setValueAtTime(gainVal, start + Math.max(0.03, dur - 0.06));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  gain.connect(ctx.destination);
  freqs.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  });
}

/**
 * Soft, pleasant chime — a C-major chord (C5/E5/G5) with a slow decay.
 * Used e.g. when a new patient joins the queue.
 */
export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, [523.25, 659.25, 783.99], now, 0.9, 0.12);
}

/**
 * A looping ringtone (classic ringback pair) for an incoming call.
 * Returns a controller; call start() to begin ringing and stop() to silence.
 */
export function createRingtone() {
  let timer: ReturnType<typeof setInterval> | null = null;

  const ring = () => {
    const ctx = getCtx();
    if (!ctx) return;
    tone(ctx, [440, 480], ctx.currentTime, 0.8, 0.16);
  };

  return {
    start() {
      if (timer) return;
      ring();
      timer = setInterval(ring, 2200);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
