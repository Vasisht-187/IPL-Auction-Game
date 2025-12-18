'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type Player = {
  socketId: string
  username: string
  isHost: boolean
  teamName: string
  purse: number
  playersBought: number
  rating: number
  hasBid?: boolean
}

type Room = {
  roomId: string
  players: Player[]
  status: string
}

type AuctionPlayer = {
  id: string
  name: string
  role: string
  category: string
  basePrice: number
  rating: number
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [roomIdInput, setRoomIdInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [highestBidder, setHighestBidder] = useState<string | null>(null)
  const [timer, setTimer] = useState(30)
  const [intervalId, setIntervalId] = useState<NodeJS.Timer | null>(null)
  const [announcement, setAnnouncement] = useState<string>('')

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

    s.on('auctionPlayer', (data: { player: AuctionPlayer; currentBid: number; highestBidder: string | null }) => {
      setCurrentPlayer(data.player)
      setCurrentBid(data.currentBid)
      setHighestBidder(data.highestBidder)
      setTimer(30)
      resetBidding()
      setAnnouncement(data.highestBidder ? `${data.highestBidder} is leading!` : `Auctioning ${data.player.name}`)
      if (intervalId) clearInterval(intervalId)
      const id = setInterval(() => setTimer(prev => {
        if (prev <= 0) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      }), 1000)
      setIntervalId(id)
    })

    s.on('auctionEnded', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      setCurrentPlayer(null)
      if (intervalId) clearInterval(intervalId)
      setAnnouncement('Auction Ended! Check ratings to see who won.')
    })

    s.on('errorMessage', (msg: string) => setError(msg))

    return () => {
      s.disconnect()
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const createRoom = () => socket?.emit('createRoom', { username })
  const joinRoom = () => socket?.emit('joinRoom', { roomId: roomIdInput.trim(), username })
  const startGame = () => socket?.emit('startGame', { roomId: room?.roomId })

  const placeBid = (amount: number) => {
    if (!socket || !me || !currentPlayer) return
    if (me.purse < currentBid + amount) return
    if (me.hasBid) return
    socket.emit('placeBid', { roomId: room?.roomId, bidAmount: currentBid + amount })
    me.hasBid = true
    setAnnouncement(`${me.username} placed a bid of ₹${(currentBid + amount).toFixed(2)}cr!`)
  }

  const resetBidding = () => {
    room?.players.forEach(p => (p.hasBid = false))
  }

  // --------- Auction UI ---------
  if (room && currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-red-900 to-black text-white p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-widest">Room: {room.roomId}</h2>
            <p className="text-gray-300 mt-1">Your Team: {me?.teamName}</p>
            <p className="text-gray-300">Purse: ₹{me?.purse}cr | Players: {me?.playersBought}</p>
            {announcement && <p className="text-yellow-400 mt-2 animate-pulse">{announcement}</p>}
          </div>

          <div className="bg-gray-900 border-2 border-red-600 rounded-xl p-6 flex flex-col items-center shadow-lg">
            <h3 className="text-3xl font-bold text-yellow-400">{currentPlayer.name}</h3>
            <p className="text-gray-300 mt-1">Role: {currentPlayer.role} | Category: {currentPlayer.category}</p>
            <p className="text-gray-300">Rating: {currentPlayer.rating}</p>
            <p className="text-yellow-500 text-2xl mt-3">Current Bid: ₹{currentBid.toFixed(2)}cr</p>
            <p className="text-gray-400 mt-1 text-sm">Highest Bidder: {highestBidder || 'None'}</p>
            <div className="w-full bg-gray-700 h-2 mt-3 rounded-full">
              <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(timer / 30) * 100}%` }}></div>
            </div>
            <p className="text-red-400 mt-1 font-bold text-lg">{timer}s</p>

            <div className="flex space-x-4 mt-4">
              {[0.25, 0.5, 1].map(amount => (
                <button
                  key={amount}
                  onClick={() => placeBid(amount)}
                  disabled={me?.purse! < currentBid + amount || me?.hasBid}
                  className={`px-5 py-2 rounded font-bold transition ${
                    me?.purse! >= currentBid + amount && !me?.hasBid
                      ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  +{amount}cr
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {room.players.map(p => (
              <div key={p.socketId} className={`p-3 rounded text-center shadow-lg ${p.username === username ? 'bg-yellow-900 border-2 border-yellow-500' : 'bg-gray-800'}`}>
                <p className="font-bold text-lg">{p.teamName}</p>
                <p className="text-sm text-gray-300">Purse: ₹{p.purse}cr</p>
                <p className="text-sm text-gray-300">Players: {p.playersBought}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --------- Lobby UI ---------
  if (room && !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-red-900 to-black">
        <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl w-full max-w-md p-6 text-white text-center space-y-4 shadow-lg">
          <h2 className="text-2xl font-bold tracking-wide">Room: {room.roomId}</h2>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.socketId} className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded">
                <span>{p.username}</span>
                {p.isHost && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">HOST</span>}
              </div>
            ))}
          </div>
          {me?.isHost && room.players.length >= 5 && (
            <button
              onClick={startGame}
              className="mt-4 w-full py-2 bg-yellow-500 text-black rounded font-bold hover:bg-yellow-400"
            >
              Start Auction
            </button>
          )}
          {room.players.length < 5 && (
            <p className="text-red-400 mt-2 font-semibold animate-pulse">Waiting for players to join... Minimum 5 required</p>
          )}
        </div>
      </div>
    )
  }

  // --------- Initial Join / Create Room UI ---------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-red-900 to-black">
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
          className={`w-full py-2 rounded font-bold transition ${isUsernameValid ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          onClick={createRoom}
        >
          Create Room
        </button>

        <div className="text-center text-gray-500 text-sm">OR</div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          placeholder="Room ID"
          value={roomIdInput}
          onChange={e => setRoomIdInput(e.target.value)}
        />

        <button
          disabled={!isUsernameValid || roomIdInput.trim().length === 0}
          className={`w-full py-2 rounded font-bold transition ${isUsernameValid && roomIdInput.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          onClick={joinRoom}
        >
          Join Room
        </button>

        {error && <div className="text-center text-red-400 text-sm">{error}</div>}
      </div>
    </div>
  )
}
