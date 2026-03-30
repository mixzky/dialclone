import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

// In a real app, this should be an env variable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('active_rooms', (rooms) => {
      setActiveRooms(rooms);
    });

    newSocket.on('room_state_update', (state) => {
      console.log('Room State Updated:', state);
      setRoomState(state);
    });

    return () => newSocket.close();
  }, []);

  const handleJoinRoom = (roomId, username) => {
    if (socket) {
      setCurrentUser({ id: socket.id, name: username });
      socket.emit('join_room', { roomId, username });
    }
  };

  if (!roomState) {
    return (
      <div className="container text-center">
        <Lobby onJoin={handleJoinRoom} activeRooms={activeRooms} />
      </div>
    );
  }

  return (
    <div className="container text-center">
      <GameRoom socket={socket} roomState={roomState} currentUser={currentUser} />
    </div>
  );
}

export default App;
