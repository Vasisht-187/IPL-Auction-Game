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
      <div className="min-h-screen text-white p-6 bg-[radial-gradient(circle_at_top,#071029,#020617_70%)] flex items-center">
        <ToastContainer />

        {/* Timer (visual only) - circular progress with label */}
        <div className="fixed top-4 right-4 flex items-center gap-3">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-full h-full">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#071029"
                strokeWidth="2"
              />
              <path
                stroke={timer <= 5 ? '#ef4444' : '#10b981'}
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, Math.min(100, (((initialDurationRef.current - timer) / Math.max(1, initialDurationRef.current)) * 100)))}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
              {timer}s
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${timer <= 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white'}`}>
            ⏱ TIMER
          </div>
        </div>

        <div className="w-full max-w-6xl mx-auto grid grid-cols-12 gap-6 items-center">

          {/* TEAMS */}
          <aside className="col-span-3 space-y-4">
            <h3 className="text-lg font-bold text-yellow-400">🏏 Teams</h3>
            {room.players.map((p, i) => (
              <div
                key={p.socketId}
                className={`p-3 rounded-xl border backdrop-blur-sm
                ${p.username === username
                  ? "border-yellow-500 bg-yellow-500/6"
                  : "border-white/6 bg-black/50"}`
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{AVATARS[i % AVATARS.length]}</div>
                    <div className="text-sm">{p.teamName || "—"}</div>
                  </div>
                  <div className="text-sm text-gray-300">👥 {p.playersBought ?? 0}</div>
                </div>
                <div className="text-xs text-gray-400 mt-2">💰 ₹{(p.purse ?? 0).toFixed ? (p.purse ?? 0).toFixed(2) : (p.purse ?? 0)}</div>
              </div>
            ))}
          </aside>

          {/* AUCTION STAGE */}
          <main className="col-span-6 flex items-center justify-center">
            <div className="w-full bg-linear-to-b from-black/60 via-black/40 to-black/30 border border-yellow-600 rounded-3xl p-8 text-center shadow-2xl">
              <p className="text-xs uppercase text-gray-400">Now Auctioning</p>

              {currentPlayer ? (
                <>
                  <div className="mt-2 flex items-center justify-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-linear-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl font-bold shadow-inner">
                      {currentPlayer.role.substring(0,2)}
                    </div>
                    <div className="text-left">
                      <h1 className="text-3xl md:text-4xl font-extrabold text-yellow-400 leading-tight">
                        {(() => {
                          const nm = splitName(currentPlayer.name)
                          return (<><span>{nm.first}</span>{nm.last ? <span className="text-yellow-200"> {nm.last}</span> : null}</>)
                        })()}
                      </h1>
                      <div className="text-sm text-gray-300 mt-1">{currentPlayer.role} · {currentPlayer.category}</div>
                      <div className="text-xs text-gray-400 mt-1">⭐ Rating: {currentPlayer.rating}</div>
                    </div>
                  </div>

                  <div className="mt-6 text-4xl md:text-5xl font-extrabold text-green-400">
                    ₹{currentBid.toFixed(2)} Cr
                  </div>

                  <p className="mt-2 text-sm text-gray-400">
                    Highest Bidder: {highestBidderTeam && highestBidder ? `${highestBidderTeam} (${highestBidder})` : "—"}
                  </p>

                  <div className="flex justify-center gap-4 mt-8">
                    {[0.25, 0.5, 32].map(v => (
                      <button
                        key={v}
                        onClick={() => placeBid(v)}
                        className="px-6 py-2 rounded-lg font-bold bg-yellow-400 text-black hover:bg-yellow-300 shadow-md"
                        disabled={(me?.playersBought || 0) >= 15}
                      >
                        +{v} Cr
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-lg mt-8 animate-pulse">
                  Loading next player...
                </div>
              )}
            </div>
          </main>

          {/* YOU */}
          <aside className="col-span-3 space-y-4">
            <h3 className="text-lg font-bold text-yellow-400">🎮 You</h3>
            <div className="bg-black/60 border border-white/6 rounded-xl p-4 shadow-lg">
              <div className="font-semibold">{me?.teamName}</div>
              <div className="text-sm text-gray-300">
                💰 ₹{me?.purse} | 👥 {me?.playersBought}
              </div>
            </div>

            <div>
              <h4 className="text-sm text-gray-400">My Squad</h4>
              {me?.boughtPlayers?.length ? (
                <ul className="mt-2 text-yellow-300 space-y-1">
                  {me.boughtPlayers.map(pl => (
                    <li key={pl.id} className="px-3 py-1 rounded bg-black/40">• {(() => { const nm = splitName(pl.name); return <>{nm.first}{nm.last ? <span className="text-yellow-200"> {nm.last}</span> : null}</> })()} <span className="text-xs text-gray-400">({pl.role})</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 mt-2">No players yet</p>
              )}
            </div>
            {/* Show your role progress and checkmarks here only */}
            {((room as any).roleProgress || []).find((r: any) => r.username === username) ? (
              (() => {
                const pr = (room as any).roleProgress.find((r: any) => r.username === username)
                return (
                  <div className="mt-4 bg-zinc-800/60 rounded-xl p-3 text-sm text-gray-200">
                    <div className="font-semibold mb-2">Squad Requirements</div>
                    <div>✔ Squad: {pr.total}/15</div>
                    <div className="flex gap-3 mt-2">
                      <div className={pr.wk >= 2 ? 'text-green-400' : 'text-gray-500'}>WK: {pr.wk}/2</div>
                      <div className={pr.bat >= 2 ? 'text-green-400' : 'text-gray-500'}>BAT: {pr.bat}/2</div>
                      <div className={pr.bowl >= 2 ? 'text-green-400' : 'text-gray-500'}>BOWL: {pr.bowl}/2</div>
                      <div className={pr.ar >= 2 ? 'text-green-400' : 'text-gray-500'}>AR: {pr.ar}/2</div>
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
