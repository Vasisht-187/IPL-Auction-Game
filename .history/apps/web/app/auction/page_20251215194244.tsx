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

export default function Auction({ roomId, username }: { roomId: string; username: string }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [highestBidder, setHighestBidder] = useState<string | null>(null)
  const [timer, setTimer] = useState(15)
  const [intervalId, setIntervalId] = useState<NodeJS.Timer | null>(null)

  const me = room?.players.find(p => p.username === username)

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.emit('joinRoom', { roomId, username })

    s.on('roomUpdated', (updatedRoom: Room) => setRoom(updatedRoom))
    s.on('auctionPlayer', (data: { player: AuctionPlayer; currentBid: number; highestBidder: string | null }) => {
      setCurrentPlayer(data.player)
      setCurrentBid(data.currentBid)
      setHighestBidder(data.highestBidder)
      setTimer(15)
      if (intervalId) clearInterval(intervalId)
      const id = setInterval(() => setTimer(prev => prev - 1), 1000)
      setIntervalId(id)
    })
    s.on('auctionEnded', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      setCurrentPlayer(null)
      if (intervalId) clearInterval(intervalId)
      alert('Auction Ended! Check ratings to see who won.')
    })

    return () => {
      s.disconnect()
      if (intervalId) 
    }
  }, [])

  const placeBid = (amount: number) => {
    if (!socket || !me) return
    if (me.purse < currentBid + amount) return
    socket.emit('placeBid', { roomId, bidAmount: currentBid + amount })
  }

  if (!room || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading auction...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Room: {room.roomId}</h2>
          <p className="text-gray-400">Your Team: {me.teamName}</p>
          <p className="text-gray-400">Your Purse: ₹{me.purse}cr | Players Bought: {me.playersBought}</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col items-center">
          <h3 className="text-2xl font-bold">{currentPlayer.name}</h3>
          <p className="text-gray-400">Role: {currentPlayer.role} | Category: {currentPlayer.category}</p>
          <p className="text-gray-400">Rating: {currentPlayer.rating}</p>
          <p className="text-yellow-500 text-xl mt-2">Current Bid: ₹{currentBid}cr</p>
          <p className="text-gray-400 text-sm">Highest Bidder: {highestBidder || 'None'}</p>
          <p className="text-red-400 mt-1">Timer: {timer}s</p>

          <div className="flex space-x-4 mt-4">
            {[0.25, 0.5, 1].map(amount => (
              <button
                key={amount}
                onClick={() => placeBid(amount)}
                disabled={me.purse < currentBid + amount}
                className={`px-4 py-2 rounded font-semibold transition ${
                  me.purse >= currentBid + amount ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                +{amount}cr
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {room.players.map(p => (
            <div key={p.socketId} className="bg-gray-800 p-3 rounded text-center">
              <p className="font-medium">{p.teamName}</p>
              <p className="text-sm text-gray-400">Purse: ₹{p.purse}cr</p>
              <p className="text-sm text-gray-400">Players: {p.playersBought}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
