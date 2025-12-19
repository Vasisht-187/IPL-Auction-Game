"use client"

import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

/* ================= TYPES ================= */

type AuctionPlayer = {
  id: string
  name: string
  role: string
  category: string
  basePrice: number
  rating: number
}

type Player = {
  socketId: string
  username: string
  isHost: boolean
  teamName?: string
  purse?: number
  playersBought?: number
  rating?: number
  boughtPlayers?: AuctionPlayer[]
}

type Room = {
  roomId: string
  players: Player[]
  status: string
}

/* ================= CONSTANTS ================= */

const IPL_TEAMS = [
  "RCB", "CSK", "MI", "KKR", "RR",
  "SRH", "DC", "PBKS", "LSG", "GT"
]

const AVATARS = ["🧢", "🏏", "🔥", "⚡", "🐯", "🦁", "🦅", "🐉", "🎯", "💥"]

/* ================= COMPONENT ================= */

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)

  const [username, setUsername] = useState("")
  const [roomIdInput, setRoomIdInput] = useState("")
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState("")

  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [highestBidder, setHighestBidder] = useState<string | null>(null)
  const [highestBidderTeam, setHighestBidderTeam] = useState<string | null>(null)

  /* ===== Auction Set UI ===== */
  const [activeSetMessage, setActiveSetMessage] = useState<string | null>(null)

  /* ===== Timer (unchanged logic) ===== */
  const [deadline, setDeadline] = useState<number | null>(null)
  const [timer, setTimer] = useState(30)
  const timerInterval = useRef<number | null>(null)
  const initialDurationRef = useRef<number>(30)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastSecondRef = useRef<number | null>(null)

  const me = room?.players.find(p => p.username === username)
  const isUsernameValid = username.trim().length > 0

  /* ================= SOCKET ================= */

  useEffect(() => {
    const s = io("http://localhost:4000")
    setSocket(s)

    // try to auto-rejoin using localStorage
    const savedRoom = localStorage.getItem('roomId')
    const savedUser = localStorage.getItem('username')
    if (savedRoom && savedUser) {
      setUsername(savedUser)
      setRoomIdInput(savedRoom)
      s.emit('joinRoom', { roomId: savedRoom, username: savedUser })
    }

    s.on("roomJoined", setRoom)
    s.on("roomUpdated", setRoom)
    s.on("gameStarted", setRoom)

    /* 🔔 Auction Set Announcement */
    s.on("auctionSetAnnouncement", data => {
      setActiveSetMessage(data.message)
      toast.info(data.message, { position: "top-center" })

      // hide message after 3s
      setTimeout(() => setActiveSetMessage(null), 3000)
    })

    s.on("auctionPlayer", data => {
      setCurrentPlayer(data.player)
      setCurrentBid(data.currentBid)
      setHighestBidder(data.highestBidder)
      setHighestBidderTeam(data.highestBidderTeam)
  const dur = data.remainingTime ?? 30
  initialDurationRef.current = dur
  setDeadline(Date.now() + dur * 1000)
    })

    s.on("playerBought", data => {
      const msg = data.teamName
        ? `${data.player.name} bought by ${data.teamName} (${data.username}) for ₹${data.price} Cr`
        : `${data.player.name} went UNSOLD`

      toast.success(msg)
      setRoom(data.updatedRoom)
      setCurrentPlayer(null)
      setDeadline(null)
    })

    s.on('roleProgress', (progress: any[]) => {
      // store per-player progress locally on room state
      setRoom(prev => {
        if (!prev) return prev
        const copy = { ...prev }
        // attach as a top-level helper
        ;(copy as any).roleProgress = progress
        return copy
      })
    })

    s.on("auctionEnded", () => {
      toast.success("Auction Ended!")
      setCurrentPlayer(null)
      setDeadline(null)
    })

    s.on("errorMessage", setError)

    return () => {
      s.disconnect()
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [])

  /* ================= TIMER ================= */

  useEffect(() => {
    if (!deadline) return
    if (timerInterval.current) clearInterval(timerInterval.current)

    timerInterval.current = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
      )
      setTimer(remaining)
    }, 250)

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [deadline])

  // play a beep using Web Audio API
  function playBeep(frequency = 880, duration = 0.12) {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = audioCtxRef.current
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = frequency
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.value = 0.0001
      const now = ctx.currentTime
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.01)
      o.start(now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      o.stop(now + duration + 0.02)
    } catch (e) {
      // ignore if audio isn't available
    }
  }

  // monitor timer for per-second ticks and urgent sound
  useEffect(() => {
    if (timer <= 5 && timer >= 1) {
      // tick every second when <=5
      if (lastSecondRef.current !== timer) {
        lastSecondRef.current = timer
        playBeep(880 - (5 - timer) * 80, 0.08)
      }
    }
    if (timer === 0) {
      playBeep(220, 0.22)
    }
  }, [timer])

  // utility to split first and last name
  function splitName(full = '') {
    const parts = full.trim().split(/\s+/)
    return { first: parts[0] || '', last: parts.slice(1).join(' ') }
  }

  /* ================= ACTIONS ================= */

  const createRoom = () => socket?.emit("createRoom", { username })

  const joinRoom = () =>
    socket?.emit("joinRoom", { roomId: roomIdInput.trim(), username })

  // persist session when room changes
  useEffect(() => {
    if (!room) return
    if (username) localStorage.setItem('username', username)
    localStorage.setItem('roomId', room.roomId)
  }, [room])

  const startGame = () =>
    socket?.emit("startGame", { roomId: room?.roomId })

  const selectTeam = (team: string) =>
    socket?.emit("selectTeam", { roomId: room?.roomId, teamName: team })

  const placeBid = (amount: number) => {
    if (!socket || !me || !currentPlayer) return
  // prevent bidding if user's squad already has 15 players
  if ((me.playersBought || 0) >= 15) return
  const newBid = +(currentBid + amount).toFixed(2)
  if ((me.purse || 0) < newBid) return
  socket.emit("placeBid", { roomId: room?.roomId, bidAmount: newBid })
  }

  /* ================= SET ANNOUNCEMENT SCREEN ================= */

  if (activeSetMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-yellow-400">
        <h1 className="text-4xl font-extrabold animate-pulse text-center">
          {activeSetMessage}
        </h1>
        <ToastContainer />
      </div>
    )
  }

  /* ================= AUCTION UI ================= */

  if (room && room.status === "STARTED") {
    return (
      <div className="min-h-screen text-white p-8 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center">
        <ToastContainer />

        {/* Timer (visual only) - circular progress with label */}
        <div className="fixed top-6 right-6 flex items-center gap-3 z-50">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-lg">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="2"
              />
              <path
                stroke={timer <= 5 ? '#ef4444' : '#fbbf24'}
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, Math.min(100, (((initialDurationRef.current - timer) / Math.max(1, initialDurationRef.current)) * 100)))}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-amber-300">
              {timer}s
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold tracking-wider ${timer <= 5 ? 'bg-red-600 text-white animate-pulse shadow-red-500/50 shadow-lg' : 'bg-amber-500 text-slate-900 shadow-amber-500/50 shadow-lg'}`}>
            ⏱ TIMER
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto grid grid-cols-12 gap-8 items-stretch">

          {/* TEAMS */}
          <aside className="col-span-3 space-y-3">
            <h3 className="text-2xl font-black text-amber-400 drop-shadow-lg uppercase tracking-widest">🏏 Teams</h3>
            {room.players.map((p, i) => (
              <div
                key={p.socketId}
                className={`p-4 rounded-2xl backdrop-blur-md border-2 transition-all duration-300 transform hover:scale-105 ${
                  p.username === username
                    ? "border-amber-500/70 bg-gradient-to-br from-amber-600/20 to-amber-700/10 shadow-lg shadow-amber-500/30"
                    : "border-slate-600/50 bg-gradient-to-br from-slate-800/40 to-slate-900/30 hover:border-slate-500/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl drop-shadow-lg">{AVATARS[i % AVATARS.length]}</span>
                    <div>
                      <div className="font-bold text-white text-lg">{p.teamName || "—"}</div>
                      <div className="text-xs text-slate-400">{p.username}</div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mt-3 space-y-1 border-t border-slate-600/30 pt-3">
                  <div className="flex justify-between">
                    <span>💰 Purse:</span>
                    <span className="font-semibold text-amber-300">₹{Number(p.purse ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>👥 Squad:</span>
                    <span className="font-semibold text-blue-300">{p.playersBought ?? 0}/15</span>
                  </div>
                </div>
              </div>
            ))}
          </aside>

          {/* AUCTION STAGE */}
          <main className="col-span-6 flex items-center justify-center">
            <div className="w-full bg-linear-to-br from-slate-900/80 via-slate-800/70 to-slate-900/80 border-2 border-amber-500/50 rounded-3xl p-10 text-center shadow-2xl shadow-amber-500/20 backdrop-blur-md">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">↓ NOW AUCTIONING ↓</p>

              {currentPlayer ? (
                <>
                  <div className="mt-6 flex items-center justify-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-linear-to-br from-amber-400 to-orange-600 flex items-center justify-center text-4xl font-bold shadow-lg shadow-amber-600/50 transform hover:scale-110 transition-transform">
                      {currentPlayer.role.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      <h1 className="text-4xl md:text-5xl font-black text-amber-300 leading-tight drop-shadow-lg">
                        {(() => {
                          const nm = splitName(currentPlayer.name)
                          return (
                            <>
                              <span>{nm.first}</span>
                              {nm.last ? <span className="text-amber-200"> {nm.last}</span> : null}
                            </>
                          )
                        })()}
                      </h1>
                      <div className="text-sm text-slate-300 mt-2 font-medium">
                        {currentPlayer.role} · {currentPlayer.category}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">⭐ Rating: <span className="text-blue-300 font-bold">{currentPlayer.rating}</span></div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-linear-to-r from-amber-300 via-amber-400 to-orange-400 drop-shadow-xl">
                      ₹{currentBid.toFixed(2)} Cr
                    </div>
                    <div className="text-sm text-slate-300">
                      Base Price: <span className="font-bold text-blue-400">₹{currentPlayer.basePrice} Cr</span>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Highest Bidder</p>
                    <p className="text-xl font-bold text-amber-300 mt-1">
                      {highestBidderTeam && highestBidder ? `${highestBidderTeam} (${highestBidder})` : "—"}
                    </p>
                  </div>

                  <div className="flex justify-center gap-4 mt-8">
                    <button
                      onClick={() => {
                        if (!currentPlayer) return
                        const base = Number(currentPlayer.basePrice ?? 0)
                        const inc = base >= 2 ? 0.5 : 0.2
                        placeBid(inc)
                      }}
                      className="px-10 py-4 rounded-xl font-bold text-lg bg-linear-to-r from-amber-400 to-orange-500 text-slate-900 hover:from-amber-300 hover:to-orange-400 shadow-lg shadow-amber-500/50 transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      disabled={(me?.playersBought || 0) >= 15 || !currentPlayer}
                    >
                      🔨 BID +{currentPlayer ? (Number(currentPlayer.basePrice ?? 0) >= 2 ? '0.5' : '0.2') : '--'} Cr
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-slate-400 text-lg mt-8 animate-pulse">
                  Loading next player...
                </div>
              )}
            </div>
          </main>

          {/* YOU */}
          <aside className="col-span-3 space-y-3">
            <h3 className="text-2xl font-black text-amber-400 drop-shadow-lg uppercase tracking-widest">🎮 You</h3>
            
            {/* Personal Card */}
            <div className="bg-linear-to-br from-slate-800/60 to-slate-900/50 border-2 border-blue-500/50 rounded-2xl p-5 shadow-lg shadow-blue-500/20 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-2xl font-black text-white">{me?.teamName || '—'}</div>
                  <div className="text-xs text-slate-400 mt-1">@{username}</div>
                </div>
                <div className="text-3xl drop-shadow-lg">{AVATARS[room.players.findIndex(p => p.username === username) % AVATARS.length]}</div>
              </div>
              
              <div className="border-t border-slate-600/50 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">💰 Purse Left:</span>
                  <span className="font-bold text-amber-300 text-lg">₹{Number(me?.purse ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">👥 Squad:</span>
                  <span className="font-bold text-blue-300">{me?.playersBought ?? 0}/15</span>
                </div>
                {me?.boughtPlayers && me.boughtPlayers.length > 0 ? (() => {
                  const totalRating = me.boughtPlayers.reduce((s, pl) => s + (pl.rating || 0), 0)
                  const avg = totalRating / me.boughtPlayers.length
                  return (
                    <div className="flex justify-between items-center bg-linear-to-r from-blue-900/40 to-purple-900/40 p-2 rounded-lg border border-blue-600/30">
                      <span className="text-slate-300">⭐ Combined Rating:</span>
                      <span className="font-bold text-purple-300">{totalRating.toFixed(1)} <span className="text-xs text-slate-400">(avg {avg.toFixed(1)})</span></span>
                    </div>
                  )
                })() : null}
              </div>
            </div>

            {/* My Squad */}
            <div className="bg-linear-to-br from-slate-800/50 to-slate-900/40 border-2 border-slate-600/40 rounded-2xl p-4 backdrop-blur-md">
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">📋 My Squad</h4>
              {me?.boughtPlayers?.length ? (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {me.boughtPlayers.map(pl => (
                    <li key={pl.id} className="px-4 py-3 rounded-lg bg-slate-700/40 border border-slate-600/50 hover:border-blue-500/50 transition-colors flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-amber-300 font-semibold">
                          {(() => {
                            const nm = splitName(pl.name)
                            return <>{nm.first}{nm.last ? ` ${nm.last}` : ''}</>
                          })()}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">({pl.role})</span>
                      </div>
                      <div className="text-sm font-bold text-blue-300 ml-2">⭐ {pl.rating}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No players yet</p>
              )}
            </div>

            {/* Squad Requirements */}
            {((room as any).roleProgress || []).find((r: any) => r.username === username) ? (
              (() => {
                const pr = (room as any).roleProgress.find((r: any) => r.username === username)
                return (
                  <div className="bg-linear-to-br from-slate-800/50 to-slate-900/40 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-500/10 backdrop-blur-md">
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-sm mb-3">✅ Requirements</div>
                    
                    <div className="space-y-3">
                      {/* Progress bars */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-300">Total Squad</span>
                          <span className="font-bold text-amber-300">{pr.total ?? 0}/15</span>
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full" style={{ width: `${Math.min(100, ((pr.total ?? 0) / 15) * 100)}%` }}></div>
                        </div>
                      </div>

                      {/* Role requirements grid */}
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-600/30 pt-3">
                        <div className={`p-2 rounded-lg text-center text-sm font-semibold ${pr.wk >= 2 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700/30 text-slate-400'}`}>
                          🧤 WK<br /><span className="text-xs">{pr.wk}/2</span>
                        </div>
                        <div className={`p-2 rounded-lg text-center text-sm font-semibold ${pr.bat >= 2 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700/30 text-slate-400'}`}>
                          🏏 BAT<br /><span className="text-xs">{pr.bat}/2</span>
                        </div>
                        <div className={`p-2 rounded-lg text-center text-sm font-semibold ${pr.bowl >= 2 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700/30 text-slate-400'}`}>
                          🎱 BOWL<br /><span className="text-xs">{pr.bowl}/2</span>
                        </div>
                        <div className={`p-2 rounded-lg text-center text-sm font-semibold ${pr.ar >= 2 ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700/30 text-slate-400'}`}>
                          🔄 AR<br /><span className="text-xs">{pr.ar}/2</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : null}
          </aside>
        </div>
      </div>
    )
  }

  /* ================= LOBBY ================= */

  if (room && room.status === "WAITING") {
    const allTeamsSelected = room.players.every(p => p.teamName)

    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-black via-slate-900 to-black text-white">
        <div className="bg-black/80 border-2 border-yellow-500 rounded-2xl p-6 w-full max-w-3xl space-y-6 shadow-xl">
          <h2 className="text-2xl font-bold text-center">
            🏟 Lobby – Room {room.roomId}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {room.players.map((p, i) => (
              <div key={p.socketId} className="bg-zinc-800 rounded-xl p-4">
                <div className="flex justify-between font-semibold">
                  <span>{p.username}</span>
                  <span>{AVATARS[i % AVATARS.length]}</span>
                </div>

                {p.teamName ? (
                  <div className="mt-2 text-green-400">✔ {p.teamName}</div>
                ) : p.username === username ? (
                  <select
                    className="mt-2 w-full bg-black border border-gray-600 rounded px-2 py-1"
                    defaultValue=""
                    onChange={e => selectTeam(e.target.value)}
                  >
                    <option value="" disabled>Select Team</option>
                    {IPL_TEAMS
                      .filter(t => !room.players.some(pl => pl.teamName === t))
                      .map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                  </select>
                ) : (
                  <div className="mt-2 text-gray-400 text-sm">
                    Selecting team…
                  </div>
                )}
              </div>
            ))}
          </div>

          {me?.isHost && (
            <button
              // disabled={room.players.length < 5 || !allTeamsSelected}
              onClick={startGame}
              className="w-full py-3 bg-yellow-400 text-black rounded-xl font-bold disabled:bg-gray-600"
            >
              Start Auction
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ================= HOME ================= */

  return (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-black via-slate-900 to-black text-white">
      <div className="bg-black/80 border-2 border-yellow-500 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-xl">
        <h1 className="text-3xl font-extrabold text-center text-yellow-400">
          IPL AUCTION
        </h1>

        <div className="text-sm text-gray-300 space-y-1">
          <p>🏏 Create or join a room</p>
          <p>🎯 Select your IPL team</p>
          <p>💰 Bid strategically with ₹100 Cr purse</p>
          <p>⏱ 30s timer resets on every bid</p>
          <p>🏆 Build the strongest squad</p>
        </div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <button
          disabled={!isUsernameValid}
          onClick={createRoom}
          className="w-full py-2 bg-yellow-400 text-black rounded-xl font-bold disabled:bg-gray-600"
        >
          Create Room
        </button>

        <div className="text-center text-gray-500">OR</div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2"
          placeholder="Room ID"
          value={roomIdInput}
          onChange={e => setRoomIdInput(e.target.value)}
        />

        <button
          disabled={!isUsernameValid || !roomIdInput.trim()}
          onClick={joinRoom}
          className="w-full py-2 bg-blue-600 rounded-xl font-bold disabled:bg-gray-600"
        >
          Join Room
        </button>

        {error && (
          <div className="text-center text-red-400 text-sm">{error}</div>
        )}
      </div>
    </div>
  )
}
