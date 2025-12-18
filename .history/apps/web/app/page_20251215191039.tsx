'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type Player = {
  socketId: string
  username: string
  isHost: boolean
}

type Room = {
  roomId: string
  players: Player[]
  status: string
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.on('roomJoined', (room: Room) => setRoom(room))
    s.on('roomUpdated', (room: Room) => setRoom(room))
    s.on('errorMessage', (msg: string) => setError(msg))

    return () => {
      s.disconnect()
    }
  }, [])

  if (room) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Room {room.roomId}</h1>

        <div className="space-y-2">
          {room.players.map(p => (
            <div key={p.socketId}>
              {p.username} {p.isHost ? '(Host)' : ''}
            </div>
          ))}
        </div>

        <div>
          Players: {room.players.length}/10
        </div>

        {room.players.length < 5 && (
          <div className="text-red-500">
            Waiting for at least 5 players to start
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">IPL Auction Lobby</h1>

      <input
        className="border p-2 w-full"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      <button
        className="bg-black text-white p-2 w-full"
        onClick={() => socket?.emit('createRoom', { username })}
      >
        Create Room
      </button>

      <input
        className="border p-2 w-full"
        placeholder="Room ID"
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white p-2 w-full"
        onClick={() => socket?.emit('joinRoom', { roomId, username })}
      >
        Join Room
      </button>

      {error && <div className="text-red-500">{error}</div>}
    </div>
  )
}
