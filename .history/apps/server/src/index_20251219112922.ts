import express from "express"
import http from "http"
import cors from "cors"
import { Server } from "socket.io"
import { randomUUID } from "crypto"
import { rooms, RoomPlayer } from "./room"
import { IPL_TEAMS } from "./teams"
import { auctionPool, AuctionPlayer } from "./auctionPool"

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*" } })

const MARQUEE_THRESHOLD = 9.0

/* ================= AUCTION SETS ================= */

const marqueePlayers = auctionPool.filter(p => p.rating >= MARQUEE_THRESHOLD)
const normalPlayers = auctionPool.filter(p => p.rating < MARQUEE_THRESHOLD)

const orderedAuctionPool = [...marqueePlayers, ...normalPlayers]

type AuctionSet = "MARQUEE" | "NORMAL"

type AuctionState = {
  currentIndex: number
  currentPlayer: AuctionPlayer | null
  currentBid: number
  highestBidderUsername: string | null
  highestBidderTeam: string | null
  lastBidTeam: string | null
  finalizeTimeout: ReturnType<typeof setTimeout> | null
  deadline: number | null
  currentSet: AuctionSet
}

const auctionStateByRoom: Record<string, AuctionState> = {}

io.on("connection", socket => {

  /* ================= ROOM ================= */

  socket.on("createRoom", ({ username }) => {
    if (!username?.trim()) return

    const roomId = randomUUID().slice(0, 6)
    rooms.set(roomId, {
      roomId,
      status: "WAITING",
      players: [{ socketId: socket.id, username, isHost: true, connected: true }]
    })

    socket.join(roomId)
    socket.emit("roomJoined", rooms.get(roomId))
  })

  socket.on("joinRoom", ({ roomId, username }) => {
    const room = rooms.get(roomId)
    if (!room) return

    // If reconnecting (same username), update socketId and mark connected
    const existing = room.players.find(p => p.username === username)
    if (existing) {
      existing.socketId = socket.id
      existing.connected = true
      existing.isHost = existing.isHost || false
    } else {
      // Prevent new joins after game has started or if room is full
      if (room.status === "STARTED" || room.players.length >= 10) return
      room.players.push({ socketId: socket.id, username, isHost: false, connected: true })
    }
    socket.join(roomId)
    io.to(roomId).emit("roomUpdated", room)
  })

  socket.on('disconnect', () => {
    // mark player disconnected and remove only after a grace period to allow reconnect
    for (const [roomId, room] of rooms.entries()) {
      const pl = room.players.find(p => p.socketId === socket.id)
      if (!pl) continue

      pl.connected = false

      // schedule removal after 20s if they don't reconnect
      setTimeout(() => {
        const still = room.players.find(p => p.username === pl.username)
        if (still && !still.connected) {
          const wasHost = still.isHost
          const idx = room.players.findIndex(rp => rp.username === still.username)
          if (idx !== -1) room.players.splice(idx, 1)

          if (room.players.length === 0) {
            rooms.delete(roomId)
            if (auctionStateByRoom[roomId]) {
              const st = auctionStateByRoom[roomId]
              if (st.finalizeTimeout) clearTimeout(st.finalizeTimeout)
              delete auctionStateByRoom[roomId]
            }
            return
          }

          if (wasHost) room.players[0].isHost = true
          io.to(roomId).emit('roomUpdated', room)
        }
      }, 20000)
    }
    })
  /* ================= TEAM SELECTION ================= */

  socket.on("selectTeam", ({ roomId, teamName }) => {
    const room = rooms.get(roomId)
    if (!room) return

    if (room.players.some(p => p.teamName === teamName)) return

    const player = room.players.find(p => p.socketId === socket.id)
    if (!player) return

    player.teamName = teamName
    io.to(roomId).emit("roomUpdated", room)
  })

  /* ================= START GAME ================= */

  socket.on("startGame", ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    const host = room.players.find(p => p.socketId === socket.id)
    if (!host || !host.isHost) return
    // if (room.players.length < 5) return
    if (room.players.some(p => !p.teamName)) return

    room.players.forEach(p => {
      p.purse = 100
      p.playersBought = 0
      p.rating = 0
      p.boughtPlayers = []
      p.connected = true
    })

    room.status = "STARTED"
    io.to(roomId).emit("gameStarted", room)

    auctionStateByRoom[roomId] = {
      currentIndex: 0,
      currentPlayer: null,
      currentBid: 0,
      highestBidderUsername: null,
      highestBidderTeam: null,
      lastBidTeam: null,
      finalizeTimeout: null,
      deadline: null,
      currentSet: "MARQUEE"
    }

    io.to(roomId).emit("auctionSetAnnouncement", {
      set: "MARQUEE",
      message: "Marquee Players Auction is about to begin!"
    })

    setTimeout(() => startNextPlayer(roomId), 3000)
  })

  /* ================= BIDDING ================= */

  socket.on("placeBid", ({ roomId, bidAmount }) => {
    const room = rooms.get(roomId)
    const st = auctionStateByRoom[roomId]
    if (!room || !st || !st.currentPlayer) return

    const me = room.players.find(p => p.socketId === socket.id)
  if (!me || bidAmount <= st.currentBid || bidAmount > (me.purse || 0)) return
  // prevent bidding if team already has full squad
  if ((me.playersBought || 0) >= 15) return
    if (st.lastBidTeam === me.teamName) return

    st.currentBid = bidAmount
    st.highestBidderUsername = me.username
    st.highestBidderTeam = me.teamName!
    st.lastBidTeam = me.teamName!

    clearTimeout(st.finalizeTimeout!)
    st.deadline = Date.now() + 30000
    st.finalizeTimeout = setTimeout(() => finalizeBid(roomId), 30000)

    io.to(roomId).emit("auctionPlayer", {
      player: st.currentPlayer,
      currentBid: st.currentBid,
      highestBidder: st.highestBidderUsername,
      highestBidderTeam: st.highestBidderTeam,
      remainingTime: Math.ceil((st.deadline - Date.now()) / 1000)
    })
  })

  /* ================= CORE AUCTION FLOW ================= */

  function startNextPlayer(roomId: string) {
    const room = rooms.get(roomId)
    const st = auctionStateByRoom[roomId]
    if (!room || !st) return

    if (st.currentIndex >= orderedAuctionPool.length) {
      io.to(roomId).emit("auctionEnded", room)
      delete auctionStateByRoom[roomId]
      return
    }

    // find next eligible player in the current set (skip if team already has 15 players)
    let idx = st.currentIndex
    let next: AuctionPlayer | undefined
    while (idx < orderedAuctionPool.length) {
      const candidate = orderedAuctionPool[idx]
      const candidateSet: AuctionSet = candidate.rating >= MARQUEE_THRESHOLD ? "MARQUEE" : "NORMAL"
      // stop scanning if we cross into a new set
      if (candidateSet !== st.currentSet) break
      next = candidate
      break
    }
    if (!next) {
      // no more players in this set, transition handled below
      next = orderedAuctionPool[st.currentIndex]
    }
    const nextSet: AuctionSet = next.rating >= MARQUEE_THRESHOLD ? "MARQUEE" : "NORMAL"

    if (nextSet !== st.currentSet) {
      st.currentSet = nextSet

      io.to(roomId).emit("auctionSetAnnouncement", {
  set: nextSet,
  message: "Marquee Players Completed. Next set (CAPPED & UNCAPPED) is starting now!"
      })

      setTimeout(() => startNextPlayer(roomId), 3000)
      return
    }

    st.currentPlayer = next
    st.currentBid = next.basePrice
    st.deadline = Date.now() + 30000
    st.finalizeTimeout = setTimeout(() => finalizeBid(roomId), 30000)

    io.to(roomId).emit("auctionPlayer", {
      player: next,
      currentBid: next.basePrice,
      highestBidder: null,
      highestBidderTeam: null,
      remainingTime: 30
    })
  }

  function finalizeBid(roomId: string) {
    const room = rooms.get(roomId)
    const st = auctionStateByRoom[roomId]
    if (!room || !st || !st.currentPlayer) return

    clearTimeout(st.finalizeTimeout!)

    const winner = st.highestBidderUsername
      ? room.players.find(p => p.username === st.highestBidderUsername)
      : null

    // helper to count roles already in a team
    const roleCounts = (p: RoomPlayer) => {
      const counts: Record<string, number> = { WK: 0, BAT: 0, BOWL: 0, AR: 0 }
      p.boughtPlayers?.forEach(bp => {
        counts[bp.role] = (counts[bp.role] || 0) + 1
      })
      return counts
    }

    if (winner) {
      // enforce 15-player limit
      if ((winner.playersBought || 0) >= 15) {
        // team already full: do not assign player
      } else {
        winner.purse! -= st.currentBid
        winner.playersBought!++
        winner.rating! += st.currentPlayer.rating
        winner.boughtPlayers!.push(st.currentPlayer)
      }
    }

    io.to(roomId).emit("playerBought", {
      player: st.currentPlayer,
      teamName: winner?.teamName || null,
      username: winner?.username || null,
      price: st.currentBid,
      updatedRoom: room
    })

    // emit role progress for UI checkmarks per player
    const progress = room.players.map(p => {
      const counts = roleCounts(p)
      return {
        username: p.username,
        teamName: p.teamName,
        total: p.playersBought || 0,
        wk: counts['WK'] || 0,
        bat: counts['BAT'] || 0,
        bowl: counts['BOWL'] || 0,
        ar: counts['AR'] || 0
      }
    })
    io.to(roomId).emit('roleProgress', progress)

    st.currentIndex++
    st.currentPlayer = null
    st.currentBid = 0
    st.highestBidderUsername = null
    st.highestBidderTeam = null
    st.lastBidTeam = null
    st.deadline = null

    setTimeout(() => startNextPlayer(roomId), 2000)
  }
})

server.listen(4000, () => {
  console.log("Server running on 4000")
})
