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

  const isUsernameValid = username.trim().length > 0

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.on('roomJoined', (room: Room) => {
      setError('')
      setRoom(room)
    })

    s.on('roomUpdated', (room: Room) => {
      setRoom(room)
    })

    s.on('errorMessage', (msg: string) => {
      setError(msg)
    })

    return () => {
      s.disconnect()
    }
  }, [])

  if (room) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4">
          <h1 className="text-xl font-bold text-center">
            Room {room.roomId}
          </h1>

          <div className="space-y-2">
            {room.players.map(p => (
              <div
                key={p.socketId}
                className="flex justify-between border-b pb-1"
              >
                <span>{p.username}</span>
                {p.isHost && (
                  <span className="text-xs font-semibold text-green-600">
                    HOST
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="text-center text-sm">
            Players: {room.players.length}/10
          </div>

          {room.players.length < 5 && (
            <div className="text-center text-red-500 text-sm">
              Waiting for at least 5 players
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">
          IPL Auction Lobby
        </h1>

        <input
          className="border p-2 w-full rounded"
          placeholder="Enter username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <button
          disabled={!isUsernameValid}
          className={`p-2 w-full rounded text-white ${
            isUsernameValid
              ? 'bg-black'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          onClick={() =>
            socket?.emit('createRoom', { username })
          }
        >
          Create Room
        </button>

        <input
          className="border p-2 w-full rounded"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
        />

        <button
          disabled={!isUsernameValid || roomId.trim().length === 0}
          className={`p-2 w-full rounded text-white ${
            isUsernameValid && roomId.trim()
              ? 'bg-blue-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          onClick={() =>
            socket?.emit('joinRoom', {
              roomId: roomId.trim(),
              username
            })
          }
        >
          Join Room
        </button>

        {error && (
          <div className="text-red-500 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
