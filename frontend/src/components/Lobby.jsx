import React, { useState } from 'react';

function Lobby({ onJoin, activeRooms = [] }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoin(roomId.trim(), username.trim());
    }
  };

  return (
    <div className="lobby-card" style={{ 
        backgroundColor: 'rgba(10, 10, 10, 0.85)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#fff', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '60px 40px',
        borderRadius: '24px',
        width: '90vw',
        maxWidth: '450px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
      
      {/* Decorative Glow */}
      <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: 'rgba(255,255,255,0.1)', filter: 'blur(60px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <h1 style={{ 
        fontSize: '4.5rem', fontWeight: 900, marginBottom: '40px', 
        letterSpacing: '-3px',
        background: 'linear-gradient(180deg, #ffffff 0%, #888888 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        zIndex: 1
      }}>dialed</h1>
      
      <form className="lobby-form" onSubmit={handleSubmit} style={{ zIndex: 1, width: '100%' }}>
        <input
          type="text"
          className="flat-input"
          placeholder="Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          maxLength={15}
        />
        <input
          type="text"
          className="flat-input"
          placeholder="Room Code"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
          maxLength={10}
          style={{ textTransform: 'uppercase' }}
        />
        <button type="submit" className="btn-floating" style={{ 
            position: 'relative', bottom: 'auto', right: 'auto', margin: '32px auto 0',
            boxShadow: '0 10px 25px rgba(255,255,255,0.2)',
            transform: 'scale(1.1)'
          }} disabled={!username.trim() || !roomId.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>

      {/* Server Browser */}
      {activeRooms.length > 0 && (
        <div style={{ marginTop: '48px', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '1.2rem', opacity: 0.7, marginBottom: '16px' }}>Public Lobbies</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {activeRooms.map(r => (
              <div 
                key={r.roomId}
                onClick={() => {
                  setRoomId(r.roomId);
                  if (username.trim()) onJoin(r.roomId, username.trim());
                }}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{r.roomId}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.state === 'LOBBY' ? 'Waiting' : 'In Progress'}</div>
                </div>
                <div style={{ opacity: 0.8 }}>
                  {r.playerCount} User{r.playerCount !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;
