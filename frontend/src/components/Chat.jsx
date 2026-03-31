import React, { useState, useEffect, useRef } from 'react';

const EMOJIS = ['😂','😍','🔥','👀','💀','😭','🤯','👏','💯','🎨','👑','😤','🥶','🤩','😎','🫡','🤌','💪','🎯','⚡','🌈','✨','😱','🙌','🥳'];

const mkAvatar = (name) => {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(name.length-1) || 0) * 13) % 360;
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="hsl(${hue},55%,35%)"/><text x="14" y="19" text-anchor="middle" font-size="12" font-family="Arial" font-weight="800" fill="white">${(name[0]||'?').toUpperCase()}</text></svg>`)}`;
};

export default function Chat({ socket, roomState, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const roomId = roomState?.roomId;

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      setMessages(prev => [...prev.slice(-99), msg]);
      if (!isOpen) setUnread(u => u + 1);
    };
    socket.on('chat_message', handler);
    return () => socket.off('chat_message', handler);
  }, [socket, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [isOpen, messages.length]);

  const send = () => {
    const msg = input.trim();
    if (!msg || !socket || !roomId) return;
    socket.emit('chat_message', {
      roomId, message: msg,
      sender: user?.name || 'Guest',
      picture: user?.picture || null,
    });
    setInput('');
    setShowEmojis(false);
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const fmt = (ts) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  if (!roomState) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '72px', // above the music bar
      left: '20px',
      width: '260px',
      zIndex: 250,
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header / Toggle */}
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: isOpen ? '14px 14px 0 0' : '14px',
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: isOpen ? '1px solid rgba(255,255,255,0.05)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#10b981', boxShadow: '0 0 5px #10b981',
            animation: 'pulse-dot 2s infinite',
          }} />
          <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Room Chat
          </span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}>
            {roomState.players?.length || 0}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!isOpen && unread > 0 && (
            <div style={{
              background: '#ef4444', color: '#fff', borderRadius: '10px',
              fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px',
            }}>{unread > 9 ? '9+' : unread}</div>
          )}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
            {isOpen ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div style={{
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: 'none',
          borderRadius: '0 0 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          height: '280px',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 11px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            scrollbarWidth: 'none',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: '0.75rem', marginTop: '40px', lineHeight: 1.7 }}>
                Say hi! 👋
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender === user?.name;
              const avatar = msg.picture || mkAvatar(msg.sender);
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: '6px' }}>
                  <img src={avatar} referrerPolicy="no-referrer"
                    style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px' }}
                    alt={msg.sender}
                  />
                  <div style={{ maxWidth: '80%' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: '2px',
                    }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', opacity: 0.5 }}>
                        {isMe ? 'You' : msg.sender}
                      </span>
                      <span style={{ fontSize: '0.52rem', opacity: 0.2, color: '#fff' }}>{fmt(msg.timestamp)}</span>
                    </div>
                    <div style={{
                      padding: '6px 9px',
                      borderRadius: isMe ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
                      background: isMe ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)',
                      color: '#fff', fontSize: '0.79rem', lineHeight: 1.45, wordBreak: 'break-word',
                    }}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Emoji picker */}
          {showEmojis && (
            <div style={{
              padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexWrap: 'wrap', gap: '2px',
            }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { setInput(p => p + e); inputRef.current?.focus(); }}
                  style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '2px', borderRadius: '4px', lineHeight: 1 }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
                >{e}</button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: '5px', alignItems: 'center',
          }}>
            <button onClick={() => setShowEmojis(s => !s)} style={{
              background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer',
              padding: '3px', borderRadius: '5px', opacity: showEmojis ? 1 : 0.4,
              transition: 'opacity 0.15s', flexShrink: 0,
            }}>😊</button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message..."
              maxLength={200}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px',
                padding: '6px 9px', color: '#fff', fontSize: '0.8rem', outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <button onClick={send} disabled={!input.trim()} style={{
              background: input.trim() ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.07)',
              border: 'none', borderRadius: '7px', padding: '6px 10px',
              color: '#000', fontWeight: 800, fontSize: '0.78rem',
              cursor: input.trim() ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif',
              transition: 'all 0.15s', flexShrink: 0,
            }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}
