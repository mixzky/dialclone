import React, { useState } from 'react';

function Lobby({ onJoin }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoin(roomId.trim(), username.trim());
    }
  };

  return (
    <div className="game-card" style={{ backgroundColor: '#000', color: '#fff', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '40px', letterSpacing: '-2px' }}>dialed</h1>
      
      <form className="lobby-form" onSubmit={handleSubmit}>
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
        <button type="submit" className="btn-floating" style={{ position: 'relative', bottom: 'auto', right: 'auto', margin: '40px auto 0' }} disabled={!username.trim() || !roomId.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>
    </div>
  );
}

export default Lobby;
