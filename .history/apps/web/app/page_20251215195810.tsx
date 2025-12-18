'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'

type Player = {
  socketId: string
  username: string
  isHost: boolean
  teamName?: string
  purse?: number
  playersBought?: number
}

type Room = {
  roomId: string
  players: Player[]
  status: string
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [roomIdInput, setRoomIdInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  const me = room?.players.find(p => p.username === username)
  const isUsernameValid = username.trim().length > 0

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.on('roomJoined', (joinedRoom: Room) => {
      setError('')
      setRoom(joinedRoom)
    })

    s.on('roomUpdated', (updatedRoom: Room) => setRoom(updatedRoom))
    s.on('gameStarted', (updatedRoom: Room) => setRoom(updatedRoom))
    s.on('errorMessage', (msg: string) => setError(msg))

    return () => s.disconnect()
  }, [])

  const createRoom = () => socket?.emit('createRoom', { username })
  const joinRoom = () => socket?.emit('joinRoom', { roomId: roomIdInput.trim(), username })
  const startGame = () => socket?.emit('startGame', { roomId: room?.roomId })

  if (room && room.status === 'STARTED') {
    return <AuctionPage username={username} roomId={room.roomId} />
  }
  // --------- Lobby UI ---------
  if (room && room.status === 'WAITING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-red-900 to-black p-4">
        <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl w-full max-w-2xl p-6 text-white space-y-4 shadow-lg">
          <h2 className="text-3xl font-bold text-center text-yellow-400">Room ID: {room.roomId}</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {room.players.map(p => (
              <div key={p.socketId} className={`p-3 rounded-lg text-center ${p.username === username ? 'bg-yellow-900 border-2 border-yellow-500' : 'bg-gray-800'}`}>
                <p className="font-bold">{p.username}</p>
                {p.isHost && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">HOST</span>}
              </div>
            ))}
          </div>

          <p className="text-center text-red-400 font-semibold animate-pulse">
            {room.players.length < 5
              ? `Waiting for players... Minimum 5 required`
              : me?.isHost
              ? `Ready to start!`
              : `Waiting for host to start the auction...`}
          </p>

          {me?.isHost && room.players.length >= 5 && (
            <button
              onClick={startGame}
              className="w-full py-3 mt-2 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition"
            >
              Start Auction
            </button>
          )}
        </div>
      </div>
    )
  }

  // --------- Initial Join / Create Room UI ---------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-red-900 to-black p-4">
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl w-full max-w-md p-6 text-white space-y-4 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-wide text-yellow-400">IPL AUCTION</h1>
          <p className="text-gray-400 text-sm mt-1">Multiplayer Auction Game</p>
        </div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <button
          disabled={!isUsernameValid}
          className={`w-full py-2 rounded font-bold transition ${
            isUsernameValid ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
          onClick={createRoom}
        >
          Create Room
        </button>

        <div className="text-center text-gray-500 text-sm mt-2">OR</div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 mt-2"
          placeholder="Room ID"
          value={roomIdInput}
          onChange={e => setRoomIdInput(e.target.value)}
        />

        <button
          disabled={!isUsernameValid || roomIdInput.trim().length === 0}
          className={`w-full py-2 rounded font-bold transition mt-1 ${
            isUsernameValid && roomIdInput.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
          onClick={joinRoom}
        >
          Join Room
        </button>

        {error && <div className="text-center text-red-400 text-sm mt-2">{error}</div>}
      </div>
    </div>
  )
}
