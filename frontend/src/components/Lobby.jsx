import React, { useState } from 'react';

function Lobby({ onJoin, activeRooms = [], defaultName = '', userPicture = null, isGuest = false }) {
  const [username, setUsername] = useState(defaultName);
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoin(roomId.trim().toUpperCase(), username.trim());
    }
  };

  const handleRoomClick = (room) => {
    if (room.state !== 'LOBBY') return; // Don't auto-join in-progress games
    setRoomId(room.roomId);
    if (username.trim()) {
      onJoin(room.roomId, username.trim());
    }
  };

  const lobbyRooms = activeRooms.filter(r => r.state === 'LOBBY');
  const inProgressRooms = activeRooms.filter(r => r.state !== 'LOBBY');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      maxWidth: '440px',
      gap: '16px',
      padding: '24px 16px',
      animation: 'lobbyEntry 0.5s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* Main Card */}
      <div style={{
        backgroundColor: 'rgba(14, 14, 14, 0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        color: '#fff',
        padding: '48px 40px 40px',
        borderRadius: '28px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Top glow accent */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: '300px', height: '160px',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <h1 style={{
          fontSize: '4rem', fontWeight: 900, marginBottom: '8px',
          letterSpacing: '-3px',
          background: 'linear-gradient(160deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          zIndex: 1,
          lineHeight: 1,
        }}>dialed</h1>

        <p style={{ fontSize: '0.8rem', opacity: 0.35, marginBottom: '36px', letterSpacing: '2px', textTransform: 'uppercase', zIndex: 1 }}>
          Color Memory Game
        </p>

        <form className="lobby-form" onSubmit={handleSubmit} style={{ zIndex: 1, width: '100%' }}>
          {/* Identity card — always read-only for both Google and Guest */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 16px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {userPicture && (
              <img src={userPicture} alt={username} referrerPolicy="no-referrer"
                style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{username}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
                {isGuest ? 'Playing as Guest' : 'Signed in with Google'}
              </div>
            </div>
          </div>

          <input
            type="text"
            className="flat-input"
            placeholder="Room code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            required
            maxLength={10}
          />
          <button
            type="submit"
            className="btn-action btn-action-primary"
            style={{ marginTop: '8px', opacity: !roomId.trim() ? 0.4 : 1 }}
            disabled={!roomId.trim()}
          >
            Join Room →
          </button>
        </form>
      </div>

      {/* Server Browser */}
      {activeRooms.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(14,14,14,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px',
          padding: '20px 24px',
          width: '100%',
        }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '2px', opacity: 0.4, textTransform: 'uppercase', color: '#fff', marginBottom: '14px' }}>
            Live Rooms
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lobbyRooms.map(r => (
              <div
                key={r.roomId}
                className="room-row"
                onClick={() => handleRoomClick(r)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="room-status-dot" />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{r.roomId}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                      Waiting for players
                    </div>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {r.playerCount} / ∞
                </div>
              </div>
            ))}

            {inProgressRooms.map(r => (
              <div key={r.roomId} className="room-row room-row-in-progress">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.95rem' }}>{r.roomId}</div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>In progress</div>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {r.playerCount} playing
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.7rem', letterSpacing: '1px' }}>
        DIALED · COLOR MEMORY v1.0
      </div>
    </div>
  );
}

export default Lobby;
