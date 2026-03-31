import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

const decodeJwt = (token) => JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function generateGuestAvatar(name) {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(name.length - 1) || 0) * 13) % 360;
  const letter = (name[0] || '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="hsl(${hue},55%,35%)"/>
    <text x="32" y="43" text-anchor="middle" font-size="26" font-family="Inter,Arial,sans-serif" font-weight="800" fill="white">${letter}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function AppContent() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('dialed_user');
    if (!saved) return null;
    const u = JSON.parse(saved);
    if (u.isGuest && !u.picture) u.picture = generateGuestAvatar(u.name);
    return u;
  });
  const [guestName, setGuestName] = useState('');
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    if (!user) return;
    const newSocket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);
    newSocket.on('active_rooms', (rooms) => setActiveRooms(rooms));
    newSocket.on('room_state_update', (state) => setRoomState(state));
    return () => newSocket.close();
  }, [user]);

  const handleGoogleSuccess = (credentialResponse) => {
    const decoded = decodeJwt(credentialResponse.credential);
    const userData = { name: decoded.name, email: decoded.email, picture: decoded.picture, sub: decoded.sub, isGuest: false };
    setUser(userData);
    localStorage.setItem('dialed_user', JSON.stringify(userData));
  };

  const handleGuestLogin = (e) => {
    e.preventDefault();
    const name = guestName.trim() || `Guest_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const picture = generateGuestAvatar(name);
    const userData = { name, picture, isGuest: true };
    setUser(userData);
    localStorage.setItem('dialed_user', JSON.stringify(userData));
  };

  const handleGoogleError = () => console.error('Google Sign-In failed');

  const handleSignOut = () => {
    if (!user?.isGuest) googleLogout();
    localStorage.removeItem('dialed_user');
    setUser(null);
    setRoomState(null);
    if (socket) { socket.close(); setSocket(null); }
  };

  const handleJoinRoom = (roomId, username) => {
    if (!socket) return;
    const safeRoom = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const safeName = username.trim().replace(/[<>&"']/g, '').slice(0, 20);
    if (!safeRoom || !safeName) return;
    const picture = user?.picture || generateGuestAvatar(safeName);
    socket.emit('join_room', { roomId: safeRoom, username: safeName, picture });
  };

  // Sign-in screen
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', padding: '24px',
      }}>
        <div style={{
          backgroundColor: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7)', borderRadius: '28px',
          padding: '52px 44px', width: '100%', maxWidth: '400px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
            width: '280px', height: '140px',
            background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <h1 style={{
            fontSize: '4rem', fontWeight: 900, letterSpacing: '-3px',
            background: 'linear-gradient(160deg, #ffffff 0%, rgba(255,255,255,0.5) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '8px', lineHeight: 1, zIndex: 1,
          }}>dialed</h1>
          <p style={{
            fontSize: '0.75rem', opacity: 0.35, marginBottom: '36px',
            letterSpacing: '2.5px', textTransform: 'uppercase', color: '#fff', zIndex: 1,
          }}>Color Memory Game</p>

          <div style={{ zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError}
              theme="filled_black" size="large" shape="rectangular" width="320" text="signin_with" />
          </div>

          <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', letterSpacing: '1px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form onSubmit={handleGuestLogin} style={{ zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value.replace(/[<>&"']/g, '').slice(0, 15))}
              placeholder="Guest name (optional)..."
              maxLength={15}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '0.85rem', outline: 'none',
                fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              }}
            />
            <button type="submit" style={{
              width: '100%', padding: '11px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Continue as Guest →
            </button>
          </form>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.7rem', letterSpacing: '1px', marginTop: '24px' }}>
          DIALED · COLOR MEMORY v1.0
        </div>
      </div>
    );
  }

  const userAvatar = user.picture || generateGuestAvatar(user.name);

  const userBar = (
    <div style={{
      position: 'fixed', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px',
      zIndex: 500, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '40px', padding: '5px 12px 5px 5px',
    }}>
      <img src={userAvatar} alt={user.name} referrerPolicy="no-referrer"
        style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0 }} />
      <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
        {user.name.split(' ')[0]}
      </span>
      {user.isGuest && (
        <span style={{ fontSize: '0.6rem', opacity: 0.35, letterSpacing: '0.5px', color: '#fff' }}>GUEST</span>
      )}
      <button onClick={handleSignOut} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
        cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', padding: '0 0 0 4px',
      }} title="Sign out">✕</button>
    </div>
  );

  if (!roomState) {
    return (
      <>
        {userBar}
        <div className="container text-center">
          <Lobby onJoin={handleJoinRoom} activeRooms={activeRooms}
            defaultName={user.name} userPicture={user.picture || userAvatar} isGuest={user.isGuest} />
        </div>
      </>
    );
  }

  return (
    <>
      {userBar}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', padding: '20px 16px', boxSizing: 'border-box' }}>
        <GameRoom socket={socket} roomState={roomState}
          currentUser={{ id: socket?.id, name: user.name, picture: userAvatar }} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContent />
    </GoogleOAuthProvider>
  );
}
