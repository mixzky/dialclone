// Web Audio API sound engine — zero audio files needed
let ctx = null;
let sfxVolume = 0.6; // 0 to 1

export const setSfxVolume = (v) => { sfxVolume = Math.max(0, Math.min(1, v)); };
export const getSfxVolume = () => sfxVolume;

const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const beep = (freq, duration, type = 'sine', vol = 0.25, delay = 0) => {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(0.001, c.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol * sfxVolume, c.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.05);
  } catch (e) {}
};

// --- Sound Effects ---

/** Soft click when toggling ready */
export const sfxReady = () => {
  beep(600, 0.08, 'sine', 0.2);
  beep(900, 0.06, 'sine', 0.15, 0.08);
};

/** Unready — descending */
export const sfxUnready = () => {
  beep(900, 0.06, 'sine', 0.15);
  beep(600, 0.08, 'sine', 0.2, 0.07);
};

/** Rising 3-note fanfare on game start */
export const sfxGameStart = () => {
  beep(440, 0.12, 'triangle', 0.3, 0.0);
  beep(550, 0.12, 'triangle', 0.3, 0.13);
  beep(660, 0.25, 'triangle', 0.35, 0.26);
};

/** Countdown tick — plays each second during memorize */
export const sfxTick = () => {
  beep(880, 0.04, 'square', 0.08);
};

/** Urgent tick for last 3 seconds */
export const sfxTickUrgent = () => {
  beep(1100, 0.05, 'square', 0.15);
};

/** Lock-in sound when submitting a guess */
export const sfxSubmit = () => {
  beep(500, 0.05, 'sine', 0.2);
  beep(700, 0.1, 'sine', 0.25, 0.05);
  beep(900, 0.15, 'sine', 0.2, 0.12);
};

/** Score reveal — ascending chime */
export const sfxScoreReveal = (pts) => {
  // Higher score = higher pitch chime
  const base = 300 + pts * 60;
  beep(base, 0.15, 'triangle', 0.3, 0.0);
  beep(base * 1.25, 0.15, 'triangle', 0.25, 0.15);
  beep(base * 1.5, 0.3, 'sine', 0.2, 0.3);
};

/** Victory jingle at end game */
export const sfxVictory = () => {
  const notes = [523, 659, 784, 1047]; // C E G C
  notes.forEach((freq, i) => {
    beep(freq, 0.2, 'triangle', 0.3, i * 0.15);
  });
};

/** Defeat — minor falling tones */
export const sfxDefeat = () => {
  beep(500, 0.2, 'triangle', 0.25, 0.0);
  beep(420, 0.2, 'triangle', 0.25, 0.18);
  beep(350, 0.35, 'sine', 0.2, 0.36);
};
