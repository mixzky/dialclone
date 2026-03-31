import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── helpers ────────────────────────────────────────────────────────────────
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

const AnimatedNumber = ({ targetValue, duration = 1400 }) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    let startTs = null, rafId;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const p = Math.min((ts - startTs) / duration, 1);
      setValue(easeOutQuart(p) * targetValue);
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [targetValue]);
  return <>{Number(value).toFixed(2)}</>;
};

const getSassyRemark = (pts) => {
  if (pts >= 9.5) return 'Uncanny. Are you even human? 👁️';
  if (pts >= 8.5) return 'Exceptional. Truly dialed in.';
  if (pts >= 7.5) return "Solid. Your eyes don't lie.";
  if (pts >= 6.0) return 'Not bad. Room to grow though.';
  if (pts >= 4.5) return 'Mediocre at best. Try harder.';
  if (pts >= 3.0) return 'Yikes. That was… a choice.';
  if (pts >= 1.5) return 'Did you even look at the color?';
  return 'Zero effort. Impressive in its own way.';
};

const randColor = () => ({
  h: Math.floor(Math.random() * 361),
  s: Math.floor(Math.random() * 71) + 20,
  l: Math.floor(Math.random() * 61) + 20,
});

const calcScore = (target, guess) => {
  let dh = Math.abs(target.h - guess.h) / 180;
  if (dh > 1) dh = 2 - dh;
  const ds = Math.abs(target.s - guess.s) / 100;
  const dl = Math.abs(target.l - guess.l) / 100;
  const dist = Math.sqrt(dh * dh * 0.5 + ds * ds * 0.25 + dl * dl * 0.25);
  return Math.max(0, Math.round((1 - dist) * 10 * 100) / 100);
};

const toHsl = (c) => `hsl(${c.h},${c.s}%,${c.l}%)`;
const textCol = (l) => (l > 55 ? '#000' : '#fff');

const MEMORIZE_S = 5;
const GUESS_S    = 20;
const RESULT_S   = 5;
const MAX_ROUNDS = 5;

// ── Slider ─────────────────────────────────────────────────────────────────
const VerticalSlider = ({ value, max, onChange, background, disabled }) => {
  const ref = useRef(null);
  const update = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    onChange(Math.round(pct * max));
  };
  const thumbPct = (value / max) * 100;
  return (
    <div ref={ref}
      onPointerDown={(e) => { if (disabled) return; e.target.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (disabled || e.buttons === 0) return; update(e); }}
      style={{ flex: 1, position: 'relative', background, touchAction: 'none', cursor: disabled ? 'default' : 'pointer' }}>
      <div style={{
        position: 'absolute', bottom: `${thumbPct}%`, left: '50%',
        transform: 'translate(-50%, 50%)',
        width: '20px', height: '20px', borderRadius: '50%',
        backgroundColor: disabled ? 'rgba(255,255,255,0.5)' : 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.2)',
        pointerEvents: 'none',
      }} />
    </div>
  );
};

// ── Score badge ─────────────────────────────────────────────────────────────
const ScoreBadge = ({ score }) => (
  <div style={{
    position: 'fixed', top: '20px', right: '20px',
    background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '40px',
    padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px',
    fontFamily: 'Inter, sans-serif', color: '#fff', zIndex: 100,
  }}>
    <span style={{ fontSize: '0.65rem', opacity: 0.4, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Score</span>
    <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '-0.5px' }}>{Number(score).toFixed(2)}</span>
  </div>
);

// ── Main ────────────────────────────────────────────────────────────────────
export default function SandboxGame() {
  // All game state in one object so phases never go stale
  const [timer, setTimer]   = useState(0);
  const stateRef = useRef({
    phase: 'START',
    round: 1,
    target: null,
    guess: { h: 180, s: 50, l: 50 },
    submitted: false,
    score: 0,
    history: [],
  });
  const [tick, forceUpdate] = useState(0); // trigger re-render
  const update = () => forceUpdate(n => n + 1);

  const intervalRef = useRef(null);

  const stopTimer = () => clearInterval(intervalRef.current);

  const startTimer = (seconds, onDone) => {
    stopTimer();
    setTimer(seconds);
    let remaining = seconds;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        onDone();
      }
    }, 1000);
  };

  const beginRound = (round) => {
    const s = stateRef.current;
    s.round = round;
    s.target = randColor();
    s.guess = { h: Math.floor(Math.random() * 361), s: 50, l: 50 };
    s.submitted = false;
    s.phase = 'MEMORIZE';
    update();

    startTimer(MEMORIZE_S, () => {
      stateRef.current.phase = 'GUESS';
      update();
      startTimer(GUESS_S, () => {
        finishRound();
      });
    });
  };

  const finishRound = () => {
    const s = stateRef.current;
    if (!s.submitted) {
      const pts = calcScore(s.target, { ...s.guess });
      s.score += pts;
      s.history = [...s.history, { target: { ...s.target }, guess: { ...s.guess }, pts }];
      s.submitted = true;
    }
    s.phase = 'RESULT';
    update();

    startTimer(RESULT_S, () => {
      const s = stateRef.current;
      if (s.round >= MAX_ROUNDS) {
        s.phase = 'END';
        update();
      } else {
        beginRound(s.round + 1);
      }
    });
  };

  const handleSubmit = () => {
    const s = stateRef.current;
    if (s.submitted || s.phase !== 'GUESS') return;
    const pts = calcScore(s.target, { ...s.guess });
    s.score += pts;
    s.history = [...s.history, { target: { ...s.target }, guess: { ...s.guess }, pts }];
    s.submitted = true;
    stopTimer();
    finishRound();
  };

  const handleStart = () => {
    stateRef.current.score = 0;
    stateRef.current.history = [];
    beginRound(1);
  };

  useEffect(() => () => stopTimer(), []);

  const s = stateRef.current;
  const { phase, round, target, guess, submitted, score, history } = s;

  // Sliders need ref-stable setters that mutate stateRef and re-render
  const setH = (v) => { stateRef.current.guess = { ...stateRef.current.guess, h: v }; update(); };
  const setS = (v) => { stateRef.current.guess = { ...stateRef.current.guess, s: v }; update(); };
  const setL = (v) => { stateRef.current.guess = { ...stateRef.current.guess, l: v }; update(); };

  const hueBg = `linear-gradient(to top,hsl(0,${guess.s}%,50%),hsl(60,${guess.s}%,50%),hsl(120,${guess.s}%,50%),hsl(180,${guess.s}%,50%),hsl(240,${guess.s}%,50%),hsl(300,${guess.s}%,50%),hsl(360,${guess.s}%,50%))`;
  const satBg = `linear-gradient(to top,hsl(${guess.h},0%,50%),hsl(${guess.h},100%,50%))`;
  const litBg = `linear-gradient(to top,hsl(${guess.h},${guess.s}%,0%),hsl(${guess.h},${guess.s}%,50%),hsl(${guess.h},${guess.s}%,100%))`;

  const page = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' };

  // ── START ────────────────────────────────────────────────────────────────
  if (phase === 'START') return (
    <div style={page}>
      <div className="game-card" style={{ backgroundColor: '#090909', color: '#fff' }}>
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: '260px', height: '120px', background: 'radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '36px 28px', gap: '12px' }}>
          <div style={{ fontSize: '2.8rem' }}>🎨</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px', margin: 0, color: '#fff' }}>Solo Sandbox</h2>
          <p style={{ opacity: 0.4, fontSize: '0.82rem', margin: 0, lineHeight: 1.7, maxWidth: '270px', color: '#fff' }}>
            Practice your color memory solo. 5 rounds, no opponents — just you and your eyes.
          </p>
          <div style={{ display: 'flex', gap: '18px', opacity: 0.3, fontSize: '0.72rem', letterSpacing: '0.5px', color: '#fff', marginTop: '4px' }}>
            <span>⏱ {MEMORIZE_S}s memorize</span>
            <span>✏️ {GUESS_S}s guess</span>
            <span>🏁 {MAX_ROUNDS} rounds</span>
          </div>
          <button className="btn-action btn-action-ready" onClick={handleStart} style={{ marginTop: '20px', maxWidth: '220px' }}>
            ▶  Start Practice
          </button>
          <a href="/" style={{ fontSize: '0.73rem', opacity: 0.25, color: '#fff', textDecoration: 'none', marginTop: '4px' }}>
            ← Back to lobby
          </a>
        </div>
      </div>
    </div>
  );

  // ── MEMORIZE ─────────────────────────────────────────────────────────────
  if (phase === 'MEMORIZE' && target) {
    const col = textCol(target.l);
    return (
      <div style={page}>
        <div className="game-card" style={{ backgroundColor: toHsl(target), color: col }}>
          <div className="round-counter" style={{ color: col, opacity: 0.6 }}>Round {round} / {MAX_ROUNDS}</div>
          <div style={{ position: 'absolute', top: '22px', right: '26px', textAlign: 'right' }}>
            <div style={{ fontSize: timer <= 2 ? '5.5rem' : '4.5rem', fontWeight: 900, letterSpacing: '-4px', lineHeight: 1, color: col, transition: 'font-size 0.15s' }}>{timer}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.5, color: col }}>Memorize</div>
          </div>
          <div style={{ position: 'absolute', bottom: '28px', left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', opacity: 0.45, color: col }}>Remember this color</div>
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>
    );
  }

  // ── GUESS ─────────────────────────────────────────────────────────────────
  if (phase === 'GUESS') return (
    <div style={page}>
      <div className="game-card" style={{ flexDirection: 'row', backgroundColor: `hsl(${guess.h},${guess.s}%,50%)` }}>
        <div style={{ position: 'absolute', top: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', borderRadius: '20px', padding: '4px 14px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
            Round {round} / {MAX_ROUNDS}
          </div>
        </div>
        <div style={{ position: 'absolute', top: '14px', right: '14px', textAlign: 'right', zIndex: 10 }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1, color: 'rgba(255,255,255,0.9)' }}>{timer}</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.5, color: '#fff' }}>to guess</div>
        </div>
        <div style={{ display: 'flex', width: '30%', minWidth: '100px', height: '100%' }}>
          <VerticalSlider value={guess.h} max={360} background={hueBg} disabled={submitted} onChange={setH} />
          <VerticalSlider value={guess.s} max={100} background={satBg} disabled={submitted} onChange={setS} />
          <VerticalSlider value={guess.l} max={100} background={litBg} disabled={submitted} onChange={setL} />
        </div>
        <div style={{ flex: 1, position: 'relative', backgroundColor: toHsl(guess) }}>
          {submitted ? (
            <div className="submitted-overlay">
              <div style={{ fontSize: '2rem', marginBottom: '4px' }}>✓</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '2px' }}>SUBMITTED</div>
            </div>
          ) : (
            <button className="btn-floating" onClick={handleSubmit} aria-label="Submit">
              <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <ScoreBadge score={score} />
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === 'RESULT') {
    const last = history[history.length - 1];
    if (!last) return null;
    const topTc = textCol(last.guess.l);
    const botTc = textCol(last.target.l);
    return (
      <div style={page}>
        <div className="game-card" style={{ flexDirection: 'column' }}>
          <div style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10, textAlign: 'right', color: topTc }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>{timer}</div>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.5 }}>
              {round >= MAX_ROUNDS ? 'Final results' : 'Next round'}
            </div>
          </div>
          <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10 }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: topTc, opacity: 0.45 }}>
              Round {round} / {MAX_ROUNDS}
            </div>
          </div>
          {/* Top: your guess */}
          <div className="result-half result-top" style={{ backgroundColor: toHsl(last.guess), color: topTc }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div className="score-large"><AnimatedNumber targetValue={last.pts} /></div>
              <div className="sassy-remark">{getSassyRemark(last.pts)}</div>
            </div>
          </div>
          {/* Bottom: original */}
          <div className="result-half result-bottom" style={{ backgroundColor: toHsl(last.target), color: botTc }} />
        </div>
        <ScoreBadge score={score} />
      </div>
    );
  }

  // ── END ─────────────────────────────────────────────────────────────────────
  if (phase === 'END') {
    const avg = history.length ? score / history.length : 0;
    const maxScore = MAX_ROUNDS * 10;

    const Swatch = ({ entry, idx }) => {
      if (!entry) return (
        <div style={{ flex: 1, aspectRatio: '1', borderRadius: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.6rem', opacity: 0.25 }}>—</span>
        </div>
      );
      const gBg = toHsl(entry.guess);
      const tBg = toHsl(entry.target);
      const scoreCol = entry.guess.l > 55 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
      return (
        <div style={{ flex: 1, aspectRatio: '1', borderRadius: '7px', overflow: 'hidden', position: 'relative', animation: `fadeSlideIn 0.25s ease ${idx * 0.05}s both` }}>
          <div style={{ position: 'absolute', inset: 0, background: gBg }} />
          <div style={{ position: 'absolute', inset: 0, background: tBg, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', top: '5px', left: '6px', fontSize: '0.68rem', fontWeight: 800, color: scoreCol, lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
            {Number(entry.pts).toFixed(2)}
          </div>
        </div>
      );
    };

    return (
      <div style={page}>
        <div className="game-card results-card" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
          <div style={{ padding: '24px 22px 20px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px', margin: '0 0 4px', color: '#fff' }}>results</h2>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: '0 0 22px', color: 'rgba(255,255,255,0.45)' }}>
              {getSassyRemark(avg)}
            </p>

            {/* Single player row — you */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>1. You</span>
                <span style={{ fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 900, color: '#fff' }}>{Number(score).toFixed(2)}</span>
                  <span style={{ opacity: 0.3, fontSize: '0.78rem' }}>/{maxScore}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {history.map((h, i) => <Swatch key={i} entry={h} idx={i} />)}
                {Array.from({ length: MAX_ROUNDS - history.length }).map((_, i) => <Swatch key={`empty-${i}`} entry={null} idx={history.length + i} />)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
              <button className="btn-action btn-action-ready" onClick={handleStart} style={{ flex: 1 }}>↩ Play Again</button>
              <a href="/" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 700,
                textDecoration: 'none', fontFamily: 'Inter, sans-serif',
              }}>← Lobby</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
