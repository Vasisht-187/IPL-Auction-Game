'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

type Player = {
  socketId: string
  username: string
  isHost: boolean
  teamName: string
  purse: number
  playersBought: number
  rating: number
  boughtPlayers?: string[]
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

export default function AuctionPage({ username, roomId }: { username: string; roomId: string }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [highestBidder, setHighestBidder] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const timerRef = useRef<number>(30) // accurate timer
  const [displayTimer, setDisplayTimer] = useState<number>(30)
  const intervalRef = useRef<NodeJS.Timer | null>(null)

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
      timerRef.current = 30
      setDisplayTimer(30)
      resetBidding()
      setAnnouncement(data.highestBidder ? `${data.highestBidder} is leading!` : `Auctioning ${data.player.name}`)

      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        timerRef.current -= 1
        setDisplayTimer(timerRef.current)
        if (timerRef.current <= 0) {
          clearInterval(intervalRef.current!)
          finalizeBid()
        }
      }, 1000)
    })

    s.on('auctionEnded', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      setCurrentPlayer(null)
      setAnnouncement('Auction Ended!')
      if (intervalRef.current) clearInterval(intervalRef.current)
    })

    return () => {
      s.disconnect()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const resetBidding = () => room?.players.forEach(p => (p.hasBid = false))

  const placeBid = (amount: number) => {
    if (!socket || !me || !currentPlayer) return
    if (me.purse < currentBid + amount) return
    if (me.hasBid) return
    socket.emit('placeBid', { roomId, bidAmount: currentBid + amount })
    me.hasBid = true
    setAnnouncement(`${me.username} bids ₹${(currentBid + amount).toFixed(2)}cr!`)
  }

  const finalizeBid = () => {
    if (!highestBidder || !room || !currentPlayer) return
    const winner = room.players.find(p => p.username === highestBidder)
    if (!winner) return
    winner.purse -= currentBid
    winner.playersBought += 1
    if (!winner.boughtPlayers) winner.boughtPlayers = []
    winner.boughtPlayers.push(currentPlayer.name)
    setAnnouncement(`${highestBidder} won ${currentPlayer.name} for ₹${currentBid.toFixed(2)}cr!`)
    setCurrentPlayer(null)
  }

  if (!room) return <div className="text-white">Connecting...</div>

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-black via-red-900 to-black p-4">
      <div className="flex flex-1 gap-4">
        {/* LEFT TEAM PANEL */}
        <div className="flex-1 bg-gray-900 p-3 rounded-xl shadow-lg">
          <h2 className="text-yellow-400 font-bold text-lg text-center">Teams</h2>
          <div className="space-y-2 mt-2">
            {room.players.map(p => (
              <div key={p.username} className={`p-2 rounded ${p.username === username ? 'bg-yellow-900 border-2 border-yellow-500' : 'bg-gray-800'}`}>
                <p className="font-bold">{p.teamName}</p>
                <p className="text-sm text-gray-300">Purse: ₹{p.purse}cr</p>
                <p className="text-sm text-gray-300">Players: {p.playersBought}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER AUCTION PLAYER */}
        <div className="flex-1 bg-gray-800 p-6 rounded-xl shadow-2xl flex flex-col items-center justify-center">
          {currentPlayer ? (
            <>
              <h1 className="text-4xl text-yellow-400 font-bold">{currentPlayer.name}</h1>
              <p className="text-gray-300 mt-2">Role: {currentPlayer.role} | Category: {currentPlayer.category}</p>
              <p className="text-gray-300">Rating: {currentPlayer.rating}</p>
              <div className="w-full bg-gray-700 h-4 mt-4 rounded-full overflow-hidden">
                <div className="bg-red-500 h-4 rounded-full transition-all" style={{ width: `${(displayTimer / 30) * 100}%` }}></div>
              </div>
              <p className="text-red-400 font-bold mt-2 text-lg">{displayTimer}s</p>
              <p className="text-yellow-300 mt-1 animate-pulse">{announcement}</p>

              <div className="flex space-x-4 mt-4">
                {[0.25, 0.5, 1].map(amount => (
                  <button
                    key={amount}
                    onClick={() => placeBid(amount)}
                    disabled={me?.hasBid || me?.purse! < currentBid + amount}
                    className={`px-6 py-2 rounded font-bold ${me?.hasBid || me?.purse! < currentBid + amount ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
                  >
                    +{amount}cr
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-lg mt-4">Waiting for next player...</p>
          )}
        </div>

        {/* RIGHT TEAM PANEL */}
        <div className="flex-1 bg-gray-900 p-3 rounded-xl shadow-lg">
          <h2 className="text-yellow-400 font-bold text-lg text-center">Players Bought</h2>
          <div className="space-y-2 mt-2">
            {room.players.map(p => (
              <div key={p.username} className="p-2 rounded bg-gray-800">
                <p className="font-bold">{p.teamName}</p>
                <p className="text-sm text-gray-300">Rating: {p.rating.toFixed(1)}</p>
                <p className="text-sm text-gray-300">{p.boughtPlayers?.join(', ') || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM USER SUMMARY */}
      {me && (
        <div className="bg-gray-900 mt-4 p-3 rounded-xl shadow-lg text-center">
          <h2 className="text-yellow-400 font-bold">Your Summary</h2>
          <p className="text-gray-300 mt-1">Players Bought: {me.playersBought} | Total Rating: {me.rating.toFixed(1)}</p>
          <p className="text-gray-300">Bought: {me.boughtPlayers?.join(', ') || '-'}</p>
        </div>
      )}
    </div>
  )
}
