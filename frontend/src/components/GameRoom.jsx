import React, { useState, useEffect, useRef } from 'react';

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

  const renderLobby = () => (
    <div className="game-card" style={{ backgroundColor: '#000', color: '#fff', cursor: isHost ? 'pointer' : 'default' }} onClick={handleStartGame}>
      <RoundCounter color="#ffffff" />
      <div className="centered-text">
        <div className="ready-text">{isHost ? 'ready' : 'waiting'}</div>
      </div>
    </div>
  );

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
        
        {/* Top Half: Selection */}
        <div className="result-half result-top" style={{ backgroundColor: topBg, color: topTc }}>
          <div className="hsl-readout top" style={{ color: topTc }}>
            <span style={{opacity: 0.6}}>Your selection</span><br/>
            H{myGuess.h} S{myGuess.s} L{myGuess.l}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: 'auto' }}>
            <div className="score-large">{Number(score).toFixed(2)}</div>
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

  const renderEndGame = () => {
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="game-card" style={{ backgroundColor: '#000', color: '#fff' }}>
        <div className="centered-text">
          <div className="score-large">Winner</div>
          <div className="ready-text" style={{ color: 'var(--accent-color)' }}>{winner?.name}</div>
        </div>
        
        {isHost && (
          <button className="btn-floating" onClick={handleStartGame} style={{ bottom: '32px', right: '32px' }}>
             <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
          </button>
        )}
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
