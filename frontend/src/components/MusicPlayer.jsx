import React, { useState, useEffect, useRef } from 'react';
import { setSfxVolume, getSfxVolume } from '../sounds';

// Extract YouTube video ID from a URL or raw ID
function extractVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  // Full URL patterns
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (match) return match[1];
  // Raw 11-char video ID
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

// Fetch video title via YouTube oEmbed (no API key needed)
async function fetchTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return 'Unknown Song';
    const data = await res.json();
    return data.title;
  } catch {
    return 'Unknown Song';
  }
}

export default function MusicPlayer({ socket, roomState }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [musicVolume, setMusicVolume] = useState(80);
  const [sfxVol, setSfxVol] = useState(Math.round(getSfxVolume() * 100));
  const playerRef = useRef(null);
  const playerDivRef = useRef(null);
  const currentVideoRef = useRef(null);

  const currentSong = roomState?.currentSong || null;
  const musicQueue = roomState?.musicQueue || [];
  const isHost = roomState?.host === socket?.id;
  const roomId = roomState?.roomId;

  // Initialize YouTube player once
  useEffect(() => {
    const initPlayer = () => {
      if (!playerDivRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 1, controls: 0 },
        events: {
          onStateChange: (event) => {
            // YT.PlayerState.ENDED = 0
            if (event.data === 0) {
              socket.emit('song_ended', { roomId });
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        initPlayer();
      };
    }
  }, []);

  // Sync playback when currentSong changes
  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong) {
      playerRef.current.stopVideo?.();
      currentVideoRef.current = null;
      return;
    }
    if (currentSong.videoId !== currentVideoRef.current) {
      currentVideoRef.current = currentSong.videoId;
      playerRef.current.loadVideoById?.(currentSong.videoId);
    }
  }, [currentSong?.videoId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    const videoId = extractVideoId(input);
    if (!videoId) {
      setError('Invalid YouTube URL or video ID');
      return;
    }
    setAdding(true);
    const title = await fetchTitle(videoId);
    const myPlayer = roomState?.players?.find(p => p.id === socket.id);
    socket.emit('add_to_queue', {
      roomId,
      videoId,
      title,
      requestedBy: myPlayer?.name || 'Someone',
    });
    setInput('');
    setAdding(false);
  };

  const handleSkip = () => {
    socket.emit('skip_song', { roomId });
  };

  if (!roomState || roomState.state === 'END_GAME') return null;

  return (
    <>
      {/* Hidden YouTube player div */}
      <div ref={playerDivRef} style={{ display: 'none' }} />

      {/* Floating bottom bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
        zIndex: 200,
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Expanded queue panel */}
        {isOpen && (
          <div style={{
            background: 'rgba(10,10,10,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0',
            padding: '20px',
            color: '#fff',
          }}>
            <div style={{ fontSize: '0.7rem', letterSpacing: '2px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '16px' }}>
              Music Queue
            </div>

            {/* Add song form */}
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                value={input}
                onChange={e => { setInput(e.target.value); setError(''); }}
                placeholder="YouTube URL or video ID..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.07)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <button
                type="submit"
                disabled={adding || !input.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: adding ? 'rgba(255,255,255,0.1)' : '#fff',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: adding ? 'wait' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  flexShrink: 0,
                }}
              >
                {adding ? '...' : '+ Add'}
              </button>
            </form>

            {error && (
              <div style={{ color: '#f87171', fontSize: '0.75rem', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            {/* Queue list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto', marginBottom: '16px' }}>
              {musicQueue.length === 0 && !currentSong && (
                <div style={{ opacity: 0.3, fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>
                  Queue is empty. Add a song!
                </div>
              )}
              {musicQueue.map((song, i) => (
                <div key={song.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)', fontSize: '0.82rem',
                }}>
                  <span style={{ opacity: 0.4, fontWeight: 700, fontSize: '0.7rem', width: '16px' }}>{i + 1}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                    <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>by {song.requestedBy}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Volume Controls */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.4, letterSpacing: '1px', textTransform: 'uppercase', width: '38px', flexShrink: 0 }}>Music</span>
                <input
                  type="range" min="0" max="100" value={musicVolume}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setMusicVolume(v);
                    playerRef.current?.setVolume?.(v);
                  }}
                  style={{ flex: 1, accentColor: '#ef4444', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.7rem', opacity: 0.5, width: '28px', textAlign: 'right' }}>{musicVolume}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.4, letterSpacing: '1px', textTransform: 'uppercase', width: '38px', flexShrink: 0 }}>SFX</span>
                <input
                  type="range" min="0" max="100" value={sfxVol}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setSfxVol(v);
                    setSfxVolume(v / 100);
                  }}
                  style={{ flex: 1, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.7rem', opacity: 0.5, width: '28px', textAlign: 'right' }}>{sfxVol}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Mini player bar */}
        <div
          onClick={() => setIsOpen(o => !o)}
          style={{
            background: 'rgba(12,12,12,0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            color: '#fff',
            borderRadius: isOpen ? '0' : '0',
          }}
        >
          {/* Music icon / playing indicator */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: currentSong ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '14px',
          }}>
            {currentSong ? '▶' : '♪'}
          </div>

          {/* Song info */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {currentSong ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentSong.title}
                </div>
                <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>
                  Requested by {currentSong.requestedBy}
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.4, fontSize: '0.82rem' }}>
                No music playing — add a song!
              </div>
            )}
          </div>

          {/* Queue count */}
          {musicQueue.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
              opacity: 0.7,
            }}>
              +{musicQueue.length} next
            </div>
          )}

          {/* Skip button (host only) */}
          {isHost && currentSong && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSkip(); }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                flexShrink: 0,
              }}
            >
              Skip ⏭
            </button>
          )}

          {/* Chevron */}
          <div style={{ opacity: 0.3, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '12px' }}>
            ▲
          </div>
        </div>
      </div>
    </>
  );
}
