import React, { useState, useEffect, useRef } from 'react';
import { sfxReady, sfxUnready, sfxGameStart, sfxTick, sfxTickUrgent, sfxSubmit, sfxScoreReveal, sfxVictory, sfxDefeat } from '../sounds';

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
  }, [targetValue, duration]);
  return <>{Number(value).toFixed(2)}</>;
};

const getSassyRemark = (pts) => {
  if (pts >= 9.5) return "Uncanny. Are you even human? 👁️";
  if (pts >= 8.5) return "Exceptional. Truly dialed in.";
  if (pts >= 7.5) return "Solid. Your eyes don't lie.";
  if (pts >= 6.0) return "Not bad. Room to grow though.";
  if (pts >= 4.5) return "Mediocre at best. Try harder.";
  if (pts >= 3.0) return "Yikes. That was... a choice.";
  if (pts >= 1.5) return "Did you even look at the color?";
  return "Zero effort. Impressive in its own way.";
};

const mkAvatar = (name, size = 32) => {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(name.length - 1) || 0) * 13) % 360;
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="hsl(${hue},55%,35%)"/><text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" font-size="${size * 0.42}" font-family="Arial" font-weight="800" fill="white">${(name[0] || '?').toUpperCase()}</text></svg>`)}`;
};

// Custom vertical slider with gradient track
const VerticalSlider = ({ value, max, onChange, background, label, disabled }) => {
  const containerRef = useRef(null);
  const handlePointerUpdate = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let pct = 1 - (e.clientY - rect.top) / rect.height;
    pct = Math.max(0, Math.min(1, pct));
    onChange(Math.round(pct * max));
  };
  const thumbPct = (value / max) * 100;
  return (
    <div ref={containerRef}
      onPointerDown={(e) => { if (disabled) return; e.target.setPointerCapture(e.pointerId); handlePointerUpdate(e); }}
      onPointerMove={(e) => { if (disabled || e.buttons === 0) return; handlePointerUpdate(e); }}
      style={{ flex: 1, position: 'relative', background, touchAction: 'none', cursor: disabled ? 'default' : 'pointer' }}>
      {/* Thumb */}
      <div style={{
        position: 'absolute', bottom: `${thumbPct}%`, left: '50%',
        transform: 'translate(-50%, 50%)',
        width: '20px', height: '20px', borderRadius: '50%',
        backgroundColor: disabled ? 'rgba(255,255,255,0.5)' : 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5), 0 0 0 3px rgba(255,255,255,0.2)',
        pointerEvents: 'none',
      }} />
      {/* Label */}
      {false && label && (
        <div style={{
          position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)',
          fontSize: '0.52rem', fontWeight: 800, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
          pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}>{label}</div>
      )}
    </div>
  );
};

function GameRoom({ socket, roomState, currentUser }) {
  const [timer, setTimer] = useState(0);
  const [guessColor, setGuessColor] = useState({ h: 180, s: 50, l: 50 });
  const [hasGuessed, setHasGuessed] = useState(false);

  useEffect(() => {
    const handler = ({ timeRemaining }) => {
      setTimer(timeRemaining);
      if (timeRemaining <= 3 && timeRemaining > 0) sfxTickUrgent();
      else if (timeRemaining > 0 && timeRemaining <= 5) sfxTick();
    };
    socket.on('timer_update', handler);
    return () => socket.off('timer_update', handler);
  }, [socket]);

  useEffect(() => {
    if (roomState.state === 'MEMORIZE') {
      setHasGuessed(false);
      setGuessColor({ h: Math.floor(Math.random() * 361), s: 50, l: 50 });
      sfxGameStart();
    }
    if (roomState.state === 'ROUND_RESULT') {
      const my = roomState.players.find(p => p.id === socket.id);
      sfxScoreReveal(my?.latestPoints || 0);
    }
    if (roomState.state === 'END_GAME') {
      const sorted = [...roomState.players].sort((a, b) => b.score - a.score);
      sorted[0]?.id === socket.id ? sfxVictory() : sfxDefeat();
    }
  }, [roomState.state, roomState.round]);

  const isHost = roomState.host === socket.id;
  const handleStartGame = () => isHost && socket.emit('start_game', { roomId: roomState.roomId });
  const handleSubmitGuess = () => {
    if (!hasGuessed) {
      socket.emit('submit_guess', { roomId: roomState.roomId, ...guessColor });
      setHasGuessed(true);
      sfxSubmit();
    }
  };
  const handleToggleReady = () => {
    const my = roomState.players.find(p => p.id === socket.id);
    my?.isReady ? sfxUnready() : sfxReady();
    socket.emit('toggle_ready', { roomId: roomState.roomId });
  };
  const handlePlayAgain = () => socket.emit('play_again', { roomId: roomState.roomId });

  const hsl = (c) => c ? `hsl(${c.h},${c.s}%,${c.l}%)` : '#000';
  const tc = (l) => l > 55 ? '#000' : '#fff';
  const urgentColor = (textColor) => textColor === '#fff' ? 'rgba(255,100,100,0.95)' : 'rgba(180,0,0,0.9)';

  // ——— LOBBY ———
  const renderLobby = () => {
    const my = roomState.players.find(p => p.id === socket.id);
    const nonHost = roomState.players.filter(p => p.id !== roomState.host);
    const canStart = roomState.players.length > 1 && nonHost.length > 0 && nonHost.every(p => p.isReady);

    return (
      <div className="game-card" style={{ backgroundColor: '#090909', color: '#fff', overflow: 'hidden' }}>
        {/* Top ambient */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: '260px', height: '120px',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '0.58rem', letterSpacing: '2.5px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '3px' }}>Room</div>
            <div style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif' }}>{roomState.roomId}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.58rem', letterSpacing: '2.5px', opacity: 0.3, textTransform: 'uppercase', marginBottom: '3px' }}>Players</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>{roomState.players.length}</div>
          </div>
        </div>

        {/* Player list */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto' }}>
          {roomState.players.map((p, i) => {
            const ready = p.id === roomState.host || p.isReady;
            const avatar = p.picture || mkAvatar(p.name);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderRadius: '14px',
                background: ready ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${ready ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.3s ease',
                animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={avatar} referrerPolicy="no-referrer"
                      style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'block' }} alt={p.name} />
                    {ready && <div style={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#10b981', border: '2px solid #090909',
                    }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                      {p.name}
                      {p.id === socket.id && <span style={{ marginLeft: '6px', fontSize: '0.58rem', opacity: 0.35, letterSpacing: '1px' }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.3, marginTop: '1px' }}>
                      {p.id === roomState.host ? '👑 Host' : 'Player'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: ready ? '#10b981' : 'rgba(255,255,255,0.25)', letterSpacing: '0.5px' }}>
                  {ready ? 'Ready ✓' : 'Waiting'}
                </div>
              </div>
            );
          })}

          {roomState.players.length < 2 && (
            <div style={{
              textAlign: 'center', padding: '20px 16px', opacity: 0.2,
              fontSize: '0.75rem', letterSpacing: '1.5px', textTransform: 'uppercase',
              border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '14px', marginTop: '4px',
            }}>
              Waiting for someone to join...
            </div>
          )}
        </div>

        {/* Action */}
        <div style={{ padding: '0 20px 24px' }}>
          {isHost ? (
            <button className={`btn-action ${canStart ? 'btn-action-ready' : 'btn-action-grey'}`}
              onClick={canStart ? handleStartGame : undefined} disabled={!canStart}
              style={{ letterSpacing: '0.5px' }}>
              {canStart ? '▶  Start Game' : roomState.players.length < 2 ? 'Need at least 2 players' : 'Waiting for players to ready up...'}
            </button>
          ) : (
            <button className={`btn-action ${my?.isReady ? 'btn-action-grey' : 'btn-action-primary'}`}
              onClick={handleToggleReady}>
              {my?.isReady ? '✗  Unready' : '✓  Click to Ready Up'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ——— MEMORIZE ———
  const renderMemorize = () => {
    const bg = hsl(roomState.targetColor);
    const color = tc(roomState.targetColor.l);
    const urgent = timer <= 3;
    return (
      <div className="game-card" style={{ backgroundColor: bg, color }}>
        <div className="round-counter" style={{ color, opacity: 0.6 }}>
          Round {roomState.round} / {roomState.maxRounds}
        </div>

        {/* Big timer */}
        <div style={{ position: 'absolute', top: '22px', right: '26px', textAlign: 'right' }}>
          <div style={{
            fontSize: urgent ? '5.5rem' : '4.5rem',
            fontWeight: 900, letterSpacing: '-4px', lineHeight: 1,
            color,
            transition: 'font-size 0.2s',
          }}>{timer}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.5, color }}>Memorize</div>
        </div>

        {/* Center hint */}
        <div style={{
          position: 'absolute', bottom: '28px', left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', opacity: 0.45, color }}>
            Remember this color
          </div>
        </div>
      </div>
    );
  };

  // ——— GUESS ———
  const renderGuess = () => {
    const { h, s, l } = guessColor;
    const sliderBg = `hsl(${h},${s}%,50%)`;
    const previewBg = hsl(guessColor);
    const color = tc(l);
    const urgent = timer <= 5;

    const hueBg = `linear-gradient(to top, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`;
    const satBg = `linear-gradient(to top, hsl(${h},0%,50%), hsl(${h},100%,50%))`;
    const litBg = `linear-gradient(to top, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))`;

    return (
      <div className="game-card" style={{ flexDirection: 'row', backgroundColor: sliderBg }}>
        {/* Round + timer */}
        <div style={{
          position: 'absolute', top: '16px', left: 0, right: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
            borderRadius: '20px', padding: '4px 14px',
            fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
          }}>
            Round {roomState.round} / {roomState.maxRounds}
          </div>
        </div>

        {/* Timer top-right */}
        <div style={{ position: 'absolute', top: '14px', right: '14px', textAlign: 'right', zIndex: 10 }}>
          <div style={{
            fontSize: urgent ? '2.8rem' : '2.2rem',
            fontWeight: 900, letterSpacing: '-2px', lineHeight: 1,
            color: 'rgba(255,255,255,0.9)',
            transition: 'all 0.2s',
          }}>{timer}</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.5, color: '#fff' }}>to guess</div>
        </div>

        {/* Sliders */}
        <div style={{
          display: 'flex', width: '30%', minWidth: '100px', height: '100%',

        }}>
          <VerticalSlider value={h} max={360} background={hueBg} label="H" disabled={hasGuessed}
            onChange={(v) => !hasGuessed && setGuessColor(p => ({ ...p, h: v }))} />
          <VerticalSlider value={s} max={100} background={satBg} label="S" disabled={hasGuessed}
            onChange={(v) => !hasGuessed && setGuessColor(p => ({ ...p, s: v }))} />
          <VerticalSlider value={l} max={100} background={litBg} label="L" disabled={hasGuessed}
            onChange={(v) => !hasGuessed && setGuessColor(p => ({ ...p, l: v }))} />
        </div>

        {/* Preview area */}
        <div style={{ flex: 1, position: 'relative', backgroundColor: previewBg }}>
          {hasGuessed ? (
            <div className="submitted-overlay">
              <div style={{ fontSize: '2rem', marginBottom: '4px' }}>✓</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '2px' }}>SUBMITTED</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.5, marginTop: '6px' }}>Waiting for others...</div>
            </div>
          ) : (
            <button className="btn-floating" onClick={handleSubmitGuess} aria-label="Submit Guess">
              <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ——— ROUND RESULT ———
  const renderResult = () => {
    const my = roomState.players.find(p => p.id === socket.id);
    const myGuess = my?.lastGuess || guessColor;
    const pts = my?.latestPoints || 0;
    const topBg = hsl(myGuess);
    const botBg = hsl(roomState.targetColor);
    const topTc = tc(myGuess.l);
    const botTc = tc(roomState.targetColor.l);

    return (
      <div className="game-card" style={{ flexDirection: 'column' }}>
        {/* Timer */}
        <div style={{
          position: 'absolute', top: '14px', right: '16px', zIndex: 10, textAlign: 'right',
          color: topTc,
        }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>{timer}</div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.5 }}>Next round</div>
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10 }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: topTc, opacity: 0.45 }}>
            Round {roomState.round} / {roomState.maxRounds}
          </div>
        </div>

        {/* Top: Your guess */}
        <div className="result-half result-top" style={{ backgroundColor: topBg, color: topTc }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div className="score-large">{pts > 0 ? <AnimatedNumber targetValue={pts} /> : '0.00'}</div>
            <div className="sassy-remark" style={{ color: topTc }}>{getSassyRemark(pts)}</div>
          </div>
        </div>

        {/* Bottom: Original */}
        <div className="result-half result-bottom" style={{ backgroundColor: botBg, color: botTc }}>
          {/* Show all players' guesses */}
          <div style={{ position: 'absolute', right: '16px', bottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {roomState.players.sort((a, b) => (b.latestPoints || 0) - (a.latestPoints || 0)).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: p.id === socket.id ? 1 : 0.6 }}>
                <span style={{ color: botTc, fontSize: '0.68rem', fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: botTc, fontSize: '0.68rem', fontWeight: 800 }}>+{Number(p.latestPoints || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ——— END GAME ———
  const renderEndGame = () => {
    const sorted = [...roomState.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const iWon = winner?.id === socket.id;
    const maxScore = roomState.maxRounds * 10;
    const gap = sorted.length > 1 ? (sorted[0].score - sorted[1].score) : 0;
    const subtitle = iWon
      ? gap < 1 ? "You barely squeaked by. Keep those eyes sharp." : "Dominant. Others weren't even close."
      : gap < 1 ? `${winner?.name} squeaked by. Everyone else was right there.` : `${winner?.name} ran away with it.`;

    const Swatch = ({ entry, idx }) => {
      if (!entry) return (
        <div style={{ flex: 1, aspectRatio: '1', borderRadius: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.6rem', opacity: 0.25 }}>—</span>
        </div>
      );
      const { target, guess, pts } = entry;
      const gBg = `hsl(${guess.h},${guess.s}%,${guess.l}%)`;
      const tBg = `hsl(${target.h},${target.s}%,${target.l}%)`;
      const scoreCol = guess.l > 55 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
      return (
        <div style={{ flex: 1, aspectRatio: '1', borderRadius: '7px', overflow: 'hidden', position: 'relative', animation: `fadeSlideIn 0.25s ease ${idx * 0.05}s both` }}>
          <div style={{ position: 'absolute', inset: 0, background: gBg }} />
          <div style={{ position: 'absolute', inset: 0, background: tBg, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', top: '5px', left: '6px', fontSize: '0.68rem', fontWeight: 800, color: scoreCol, lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
            {Number(pts).toFixed(2)}
          </div>
        </div>
      );
    };

    return (
      <div className="game-card results-card" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
        <div style={{ padding: '24px 22px 20px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-1px', margin: '0 0 4px', color: '#fff' }}>results</h2>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: '0 0 22px', color: 'rgba(255,255,255,0.45)' }}>{subtitle}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {sorted.map((p, i) => {
              const hist = p.roundHistory || [];
              const isMe = p.id === socket.id;
              return (
                <div key={p.id} style={{ animation: `fadeSlideIn 0.35s ease ${i * 0.08}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
                      {i + 1}. {p.name}
                      {isMe && <span style={{ fontSize: '0.58rem', opacity: 0.3, letterSpacing: '1px', marginLeft: '6px' }}>YOU</span>}
                    </span>
                    <span style={{ fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: 900, color: i === 0 ? '#fff' : 'rgba(255,255,255,0.65)' }}>{Number(p.score).toFixed(2)}</span>
                      <span style={{ opacity: 0.3, fontSize: '0.78rem' }}>/{maxScore}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {Array.from({ length: roomState.maxRounds }).map((_, ri) => (
                      <Swatch key={ri} entry={hist[ri]} idx={ri} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            {isHost ? (
              <button className="btn-action btn-action-primary" onClick={handlePlayAgain} style={{ maxWidth: '240px' }}>
                ↩ Play Again
              </button>
            ) : (
              <div style={{ fontSize: '0.78rem', opacity: 0.3, letterSpacing: '1px', padding: '12px 0' }}>
                Waiting for host to restart...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ——— Real-time Leaderboard ———
  const renderLeaderboard = () => {
    if (roomState.state === 'LOBBY' || roomState.state === 'END_GAME') return null;
    const sorted = [...roomState.players].sort((a, b) => b.score - a.score);
    return (
      <div className="realtime-leaderboard">
        {sorted.map((p, i) => {
          const avatar = p.picture || mkAvatar(p.name);
          return (
            <div key={p.id} className={`leaderboard-item ${p.hasGuessed ? 'locked' : ''}`}>
              <img src={avatar} referrerPolicy="no-referrer"
                style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0 }} alt={p.name} />
              <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, opacity: 0.85 }}>
                  {Number(p.score).toFixed(2)}
                </span>
                {p.hasGuessed && p.latestPoints > 0 && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 800, color: '#86efac',
                    background: 'rgba(16,185,129,0.22)', padding: '1px 5px',
                    borderRadius: '10px', animation: 'fadeSlideIn 0.4s ease',
                  }}>+{Number(p.latestPoints).toFixed(2)}</span>
                )}
              </div>
              <div className={p.hasGuessed ? 'leaderboard-dot-done' : 'leaderboard-dot-waiting'} />
            </div>
          );
        })}
      </div>
    );
  };

  const renderers = { LOBBY: renderLobby, MEMORIZE: renderMemorize, GUESS: renderGuess, ROUND_RESULT: renderResult, END_GAME: renderEndGame };
  const render = renderers[roomState.state];

  return (
    <>
      {render ? render() : null}
      {renderLeaderboard()}
    </>
  );
}

export default GameRoom;
