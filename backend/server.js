const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Memory state
const rooms = {};
const socketRateLimits = {}; // { socketId: { lastChat, joinCount } }

// --- Security helpers ---
const sanitizeText = (str = '', maxLen = 200) =>
  String(str).replace(/[<>&"']/g, '').trim().slice(0, maxLen);

const sanitizeRoomId = (id = '') =>
  String(id).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

const clampHSL = (h, s, l) => ({
  h: Math.max(0, Math.min(360, Math.round(Number(h) || 0))),
  s: Math.max(0, Math.min(100, Math.round(Number(s) || 0))),
  l: Math.max(0, Math.min(100, Math.round(Number(l) || 0))),
});

const canChat = (socketId) => {
  const now = Date.now();
  if (!socketRateLimits[socketId]) socketRateLimits[socketId] = {};
  const last = socketRateLimits[socketId].lastChat || 0;
  if (now - last < 500) return false; // 500ms cooldown
  socketRateLimits[socketId].lastChat = now;
  return true;
};

const GAME_SETTINGS = {
  MAX_ROUNDS: 5,
  MEMORIZE_TIME: 5, // seconds
  GUESS_TIME: 20,   // seconds (increased slightly for 3 sliders)
  RESULT_TIME: 7    // seconds
};

function generateColor() {
  return {
    h: Math.floor(Math.random() * 361), // 0-360
    s: Math.floor(Math.random() * 101), // 0-100
    l: Math.floor(Math.random() * 81) + 10 // 10-90 to avoid pure black/white being too common
  };
}

/**
 * Calculate distance using a cylindrical representation of HSL.
 * Hue is circular (0=360), so we find the shortest path.
 */
function calculateScore(target, guess) {
  if (!guess) return 0;
  
  // Normalized differences (0 to 1)
  let dh = Math.abs(target.h - guess.h) / 180;
  if (dh > 1) dh = 2 - dh; // Shortest path around the circle

  const ds = Math.abs(target.s - guess.s) / 100;
  const dl = Math.abs(target.l - guess.l) / 100;

  // Maximum possible distance in this space is sqrt(1^2 + 1^2 + 1^2) = sqrt(3) ~ 1.732
  const maxDist = Math.sqrt(3);
  const dist = Math.sqrt(dh*dh + ds*ds + dl*dl);
  
  const percentage = 1 - (dist / maxDist);
  // Curve the score to make it more rewarding for close guesses
  const score = Math.max(0, Math.pow(percentage, 2) * 10); 
  return parseFloat(score.toFixed(2));
}

function emitRoomState(roomId) {
  if (rooms[roomId]) {
    io.to(roomId).emit('room_state_update', getPublicRoomState(roomId));
  }
}

function getActiveRooms() {
  return Object.values(rooms).map(r => ({
    roomId: r.roomId,
    playerCount: Object.keys(r.players).length,
    state: r.state
  }));
}

function emitActiveRooms() {
  io.emit('active_rooms', getActiveRooms());
}

function getPublicRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;
  return {
    roomId: room.roomId,
    state: room.state,
    players: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      picture: p.picture || null,
      score: p.score,
      latestPoints: p.latestPoints || 0,
      isReady: p.isReady,
      hasGuessed: !!p.currentGuess,
      lastGuess: (room.state === 'ROUND_RESULT' || room.state === 'END_GAME') ? p.currentGuess : null,
      roundHistory: p.roundHistory || [],
    })),
    host: room.host,
    targetColor: (room.state !== 'LOBBY') ? room.targetColor : null,
    round: room.round,
    maxRounds: room.MAX_ROUNDS,
    timeRemaining: room.timeRemaining,
  };
}


function startTimer(roomId, currentPhase, durationSec, onEnd) {
  const room = rooms[roomId];
  if (!room) return;
  
  if (room.timer) clearInterval(room.timer);
  room.timeRemaining = durationSec;

  io.to(roomId).emit('timer_update', { timeRemaining: room.timeRemaining, phase: currentPhase });

  room.timer = setInterval(() => {
    room.timeRemaining--;
    io.to(roomId).emit('timer_update', { timeRemaining: room.timeRemaining, phase: currentPhase });

    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      onEnd();
    }
  }, 1000);
}

function startMemorizePhase(roomId) {
  const room = rooms[roomId];
  if(!room) return;

  room.state = 'MEMORIZE';
  room.targetColor = generateColor();
  
  // Clear previous guesses
  for(let pId in room.players) {
    room.players[pId].currentGuess = null;
  }
  
  emitRoomState(roomId);

  startTimer(roomId, 'MEMORIZE', GAME_SETTINGS.MEMORIZE_TIME, () => {
    startGuessPhase(roomId);
  });
}

function startGuessPhase(roomId) {
  const room = rooms[roomId];
  if(!room) return;

  room.state = 'GUESS';
  emitRoomState(roomId);

  startTimer(roomId, 'GUESS', GAME_SETTINGS.GUESS_TIME, () => {
    startResultPhase(roomId);
  });
}

function checkAllGuessed(roomId) {
  const room = rooms[roomId];
  if(!room) return false;
  
  let allGuessed = Object.values(room.players).length > 0;
  for (let p of Object.values(room.players)) {
    if (!p.currentGuess) {
      allGuessed = false;
      break;
    }
  }
  return allGuessed;
}

function startResultPhase(roomId) {
  const room = rooms[roomId];
  if(!room) return;

  if (room.timer) clearInterval(room.timer);

  // Auto-record a missed entry for players who didn't submit
  for (const pId in room.players) {
    const p = room.players[pId];
    if (!p.currentGuess) {
      // Player missed — record 0 pts with their last known guess (or default)
      const missedGuess = p.lastGuess || { h: 180, s: 50, l: 50 };
      if (!p.roundHistory) p.roundHistory = [];
      p.roundHistory.push({ target: room.targetColor, guess: missedGuess, pts: 0, missed: true });
    }
  }

  room.state = 'ROUND_RESULT';
  
  emitRoomState(roomId);

  startTimer(roomId, 'ROUND_RESULT', GAME_SETTINGS.RESULT_TIME, () => {
    if (room.round >= room.MAX_ROUNDS) {
      endGame(roomId);
    } else {
      room.round++;
      startMemorizePhase(roomId);
    }
  });
}

function endGame(roomId) {
  const room = rooms[roomId];
  if(!room) return;
  room.state = 'END_GAME';
  emitRoomState(roomId);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.emit('active_rooms', getActiveRooms());

  socket.on('join_room', ({ roomId, username, picture }) => {
    const safeRoom = sanitizeRoomId(roomId);
    const safeName = sanitizeText(username, 20) || `Player_${socket.id.slice(0, 4)}`;
    const safePic = typeof picture === 'string' && picture.startsWith('http') ? picture
      : typeof picture === 'string' && picture.startsWith('data:image') ? picture : null;

    if (!safeRoom) return;
    socket.join(safeRoom);
    if (!rooms[safeRoom]) {
      rooms[safeRoom] = {
        roomId: safeRoom,
        state: 'LOBBY',
        players: {},
        targetColor: null,
        round: 1,
        MAX_ROUNDS: GAME_SETTINGS.MAX_ROUNDS,
        host: socket.id,
        timer: null,
        timeRemaining: 0,
      };
    }

    const isHost = rooms[safeRoom].host === socket.id;
    rooms[safeRoom].players[socket.id] = {
      id: socket.id,
      name: safeName,
      picture: safePic,
      score: 0,
      latestPoints: 0,
      isReady: isHost,
      currentGuess: null
    };

    emitRoomState(safeRoom);
    emitActiveRooms();
  });

  socket.on('toggle_ready', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.state === 'LOBBY' && room.players[socket.id]) {
      if (room.host !== socket.id) {
        room.players[socket.id].isReady = !room.players[socket.id].isReady;
        emitRoomState(roomId);
      }
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id && room.state === 'LOBBY') {
      const allPlayers = Object.values(room.players);
      
      // Enforce at least 2 players (Host + 1)
      if (allPlayers.length < 2) return;
      
      // Enforce everyone is ready
      const allReady = allPlayers.every(p => p.isReady);
      if (!allReady) return;

      room.round = 1;
      for(let pId in room.players) {
        room.players[pId].score = 0;
        room.players[pId].latestPoints = 0;
        room.players[pId].roundHistory = [];
      }
      startMemorizePhase(roomId);
      emitActiveRooms();
    }
  });

  socket.on('submit_guess', ({ roomId, h, s, l }) => {
    const safeRoom = sanitizeRoomId(roomId);
    const room = rooms[safeRoom];
    if (room && room.state === 'GUESS' && room.players[socket.id]) {
      const p = room.players[socket.id];
      if (!p.currentGuess) {
        const guess = clampHSL(h, s, l);
        p.currentGuess = guess;
        p.lastGuess = guess;
        const pts = calculateScore(room.targetColor, guess);
        p.latestPoints = pts;
        p.score += pts;
        if (!p.roundHistory) p.roundHistory = [];
        p.roundHistory.push({ target: room.targetColor, guess, pts });
        emitRoomState(safeRoom);
        if (checkAllGuessed(safeRoom)) startResultPhase(safeRoom);
      }
    }
  });

  socket.on('play_again', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id && room.state === 'END_GAME') {
      room.state = 'LOBBY';
      room.round = 1;
      room.targetColor = null;
      for(let pId in room.players) {
        room.players[pId].score = 0;
        room.players[pId].latestPoints = 0;
        room.players[pId].currentGuess = null;
        room.players[pId].roundHistory = [];
        room.players[pId].isReady = (pId === room.host);
      }
      emitRoomState(roomId);
      emitActiveRooms();
    }
  });

  socket.on('disconnect', () => {
    delete socketRateLimits[socket.id];
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
          if (room.timer) clearInterval(room.timer);
          delete rooms[roomId];
        } else {
          if (room.host === socket.id) {
            room.host = Object.keys(room.players)[0];
          }
          emitRoomState(roomId);
        }
      }
    }
    emitActiveRooms();
  });
});

server.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
