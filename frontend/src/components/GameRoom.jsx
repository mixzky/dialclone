import React, { useState, useEffect, useRef } from 'react';

// --- Custom Animated Number ---
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

const AnimatedNumber = ({ targetValue, duration = 1500 }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const easedProgress = easeOutQuart(progress);
      setValue(easedProgress * targetValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return <>{Number(value).toFixed(2)}</>;
};

// --- Custom Vertical Slider ---
const VerticalSlider = ({ value, max, onChange, background }) => {
  const containerRef = useRef(null);

  const handlePointerUpdate = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let percentage = 1 - (y / rect.height);
    if (percentage < 0) percentage = 0;
    if (percentage > 1) percentage = 1;
    onChange(Math.round(percentage * max));
  };

  const onPointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    handlePointerUpdate(e);
  };

  const onPointerMove = (e) => {
    if (e.buttons > 0) {
      handlePointerUpdate(e);
    }
  };

  const thumbPosition = (value / max) * 100;
  
  return (
    <div 
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      style={{ 
        flex: 1, 
        position: 'relative', 
        background, 
        touchAction: 'none', 
        cursor: 'pointer' 
      }}
    >
      <div style={{
        position: 'absolute',
        bottom: `${thumbPosition}%`,
        left: '50%',
        transform: 'translate(-50%, 50%)',
        width: '24px',
        height: '24px',
        backgroundColor: 'white',
        borderRadius: '50%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'none'
      }} />
    </div>
  );
};

// --- Main Game Component ---
function GameRoom({ socket, roomState, currentUser }) {
  const [timer, setTimer] = useState(0);
  const [guessColor, setGuessColor] = useState({ h: 180, s: 50, l: 50 });
  const [hasGuessed, setHasGuessed] = useState(false);

  useEffect(() => {
    const handleTimerUpdate = ({ timeRemaining }) => setTimer(timeRemaining);
    socket.on('timer_update', handleTimerUpdate);
    return () => socket.off('timer_update', handleTimerUpdate);
  }, [socket]);

  useEffect(() => {
    if (roomState.state === 'MEMORIZE') {
      setHasGuessed(false);
      setGuessColor({ h: Math.floor(Math.random()*361), s: 50, l: 50 });
    }
  }, [roomState.state]);

  const isHost = roomState.host === socket.id;

  const handleStartGame = () => {
    if (isHost) socket.emit('start_game', { roomId: roomState.roomId });
  };

  const handleSubmitGuess = () => {
    if (!hasGuessed) {
      socket.emit('submit_guess', { roomId: roomState.roomId, ...guessColor });
      setHasGuessed(true);
    }
  };

  const getColorString = (colorObj) => {
    if (!colorObj) return '#000000';
    return `hsl(${colorObj.h}, ${colorObj.s}%, ${colorObj.l}%)`;
  };

  const getTextColor = (l) => l > 50 ? '#000000' : '#ffffff';

  const RoundCounter = ({ color }) => (
    <div className="round-counter" style={{ color }}>
      {roomState.round}/{roomState.maxRounds}
    </div>
  );

  // ---------------- Render States ----------------

  const handleToggleReady = () => {
    socket.emit('toggle_ready', { roomId: roomState.roomId });
  };

  const renderLobby = () => {
    const myPlayer = roomState.players.find(p => p.id === socket.id);
    const isReady = myPlayer?.isReady;
    
    // Check start conditions
    const nonHostPlayers = roomState.players.filter(p => p.id !== roomState.host);
    const allOthersReady = nonHostPlayers.length > 0 && nonHostPlayers.every(p => p.isReady);
    const canStart = roomState.players.length > 1 && allOthersReady;

    return (
      <div className="game-card" style={{ backgroundColor: '#000', color: '#fff' }}>
        <RoundCounter color="#ffffff" />
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '64px 32px 32px 32px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>Lobby</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
            {roomState.players.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px' }}>
                <span style={{ fontWeight: 600 }}>{p.name} {p.id === roomState.host ? '(Host)' : ''}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{p.id === roomState.host ? 'Ready' : (p.isReady ? 'Ready' : 'Waiting')}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (p.id === roomState.host || p.isReady) ? '#10b981' : '#4b5563' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            {isHost ? (
               <button 
                 onClick={canStart ? handleStartGame : null}
                 style={{
                   width: '100%', padding: '16px', borderRadius: '12px', border: 'none', 
                   backgroundColor: canStart ? '#fff' : '#333', 
                   color: canStart ? '#000' : '#888',
                   fontSize: '1.2rem', fontWeight: 800, cursor: canStart ? 'pointer' : 'not-allowed',
                   transition: 'all 0.2s'
                 }}
               >
                 {canStart ? 'Start Game' : 'Waiting for Players...'}
               </button>
            ) : (
               <button 
                 onClick={handleToggleReady}
                 style={{
                   width: '100%', padding: '16px', borderRadius: '12px', border: 'none', 
                   backgroundColor: isReady ? '#10b981' : '#fff', 
                   color: isReady ? '#fff' : '#000',
                   fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer',
                   transition: 'all 0.2s'
                 }}
               >
                 {isReady ? 'Unready' : 'Click to Ready Up'}
               </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMemorize = () => {
    const bg = getColorString(roomState.targetColor);
    const tc = getTextColor(roomState.targetColor.l);
    return (
      <div className="game-card" style={{ backgroundColor: bg, color: tc }}>
        <RoundCounter color={tc} />
        
        <div style={{ position: 'absolute', top: '32px', right: '32px', textAlign: 'right' }}>
          <div className="timer-large">{timer}</div>
          <div className="timer-sub">Seconds to remember</div>
        </div>
      </div>
    );
  };

  const renderGuess = () => {
    const { h, s, l } = guessColor;
    const bg = getColorString(guessColor);
    const tc = getTextColor(l);

    // Dynamic Gradients
    const hueBkg = `linear-gradient(to top, 
      hsl(0, ${s}%, ${l}%), hsl(60, ${s}%, ${l}%), 
      hsl(120, ${s}%, ${l}%), hsl(180, ${s}%, ${l}%), 
      hsl(240, ${s}%, ${l}%), hsl(300, ${s}%, ${l}%), 
      hsl(360, ${s}%, ${l}%))`;
    
    const satBkg = `linear-gradient(to top, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`;
    const litBkg = `linear-gradient(to top, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%))`;

    return (
      <div className="game-card" style={{ backgroundColor: bg, color: tc, flexDirection: 'row' }}>
        <div style={{ position: 'absolute', top: '32px', left: '50%', transform: 'translateX(-50%)', fontWeight: 700, fontSize: '0.9rem', zIndex: 10 }}>
          {roomState.round}/{roomState.maxRounds}
        </div>

        <div style={{ position: 'absolute', top: '32px', right: '32px', textAlign: 'right', zIndex: 10 }}>
          <div className="timer-large" style={{ fontSize: '2rem' }}>{timer}</div>
          <div className="timer-sub" style={{ fontSize: '0.8rem' }}>Seconds to guess</div>
        </div>

        <div style={{ display: 'flex', width: '25%', minWidth: '120px', height: '100%', borderRight: '1px solid rgba(0,0,0,0.1)' }}>
          <VerticalSlider 
            value={h} max={360} background={hueBkg}
            onChange={(val) => !hasGuessed && setGuessColor(prev => ({...prev, h: val}))} 
          />
          <VerticalSlider 
            value={s} max={100} background={satBkg}
            onChange={(val) => !hasGuessed && setGuessColor(prev => ({...prev, s: val}))} 
          />
          <VerticalSlider 
            value={l} max={100} background={litBkg}
            onChange={(val) => !hasGuessed && setGuessColor(prev => ({...prev, l: val}))} 
          />
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          {!hasGuessed && (
            <button className="btn-floating" onClick={handleSubmitGuess} aria-label="Submit Guess">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderResult = () => {
    // Current user's score details
    const myPlayer = roomState.players.find(p => p.id === socket.id);
    const myGuess = myPlayer?.lastGuess || guessColor;
    const score = myPlayer?.score || 0;
    
    const topBg = getColorString(myGuess);
    const bottomBg = getColorString(roomState.targetColor);
    const topTc = getTextColor(myGuess.l);
    const bottomTc = getTextColor(roomState.targetColor.l);

    return (
      <div className="game-card" style={{ flexDirection: 'column' }}>
        <RoundCounter color={topTc} />
        
        <div style={{ position: 'absolute', top: '32px', right: '32px', textAlign: 'right', zIndex: 10, color: topTc }}>
          <div className="timer-large" style={{ fontSize: '2rem' }}>{timer}</div>
          <div className="timer-sub" style={{ fontSize: '0.8rem' }}>Next phase</div>
        </div>

        {/* Top Half: Selection */}
        <div className="result-half result-top" style={{ backgroundColor: topBg, color: topTc }}>
          <div className="hsl-readout top" style={{ color: topTc }}>
            <span style={{opacity: 0.6}}>Your selection</span><br/>
            H{myGuess.h} S{myGuess.s} L{myGuess.l}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: 'auto' }}>
            <div className="score-large">{myPlayer?.latestPoints ? <AnimatedNumber targetValue={myPlayer.latestPoints} /> : '0.00'}</div>
            <div className="sassy-remark" style={{ opacity: 0.8 }}>You're skating on the thin ice of adequacy.</div>
          </div>
        </div>

        {/* Bottom Half: Original */}
        <div className="result-half result-bottom" style={{ backgroundColor: bottomBg, color: bottomTc }}>
          <div className="hsl-readout bottom" style={{ color: bottomTc }}>
            <span style={{opacity: 0.6}}>Original</span><br/>
            H{roomState.targetColor.h} S{roomState.targetColor.s} L{roomState.targetColor.l}
          </div>
          
          {isHost && (
            <button className="btn-floating" onClick={handleStartGame}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const handlePlayAgain = () => {
    socket.emit('play_again', { roomId: roomState.roomId });
  };

  const renderEndGame = () => {
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="game-card" style={{ backgroundColor: '#000', color: '#fff' }}>
        <div className="centered-text w-100" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '1rem', letterSpacing: '2px', opacity: 0.6, marginBottom: '16px' }}>MATCH COMPLETE</div>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '24px' }}>
            {winner?.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>Wins</span>
          </h2>
          <div className="score-large" style={{ marginBottom: '48px', color: '#10b981' }}>{Number(winner?.score).toFixed(2)} <span style={{fontSize:'1.5rem', opacity:0.7}}>/ 50.00 pts</span></div>
          
          {isHost ? (
            <button 
              onClick={handlePlayAgain}
              style={{
                width: '100%', maxWidth: '300px', padding: '16px', borderRadius: '12px', border: 'none', 
                backgroundColor: '#fff', color: '#000',
                fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Play Again
            </button>
          ) : (
            <div style={{ opacity: 0.6 }}>Waiting for host to restart...</div>
          )}
        </div>
      </div>
    );
  };

  const stateRenderers = {
    'LOBBY': renderLobby,
    'MEMORIZE': renderMemorize,
    'GUESS': renderGuess,
    'ROUND_RESULT': renderResult,
    'END_GAME': renderEndGame
  };

  const currentRenderer = stateRenderers[roomState.state];

  // Global Real-time Player Status Overlay
  const renderRealTimeLeaderboard = () => {
    if (roomState.state === 'LOBBY') return null;
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    return (
      <div className="realtime-leaderboard">
        {sortedPlayers.map(p => (
          <div key={p.id} className={`leaderboard-item ${p.hasGuessed ? 'locked' : ''}`}>
             <div style={{ flex: 1 }}>{p.name}</div>
             <div style={{ opacity: 0.8, fontSize: '0.8rem' }}>{Number(p.score).toFixed(2)} pts</div>
             <div style={{
               width: '8px', height: '8px', borderRadius: '50%', 
               backgroundColor: p.hasGuessed ? '#fff' : 'rgba(255,255,255,0.3)'
             }} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {currentRenderer ? currentRenderer() : null}
      {renderRealTimeLeaderboard()}
    </>
  );
}

export default GameRoom;
