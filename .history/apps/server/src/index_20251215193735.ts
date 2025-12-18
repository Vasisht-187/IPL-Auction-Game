import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { rooms, RoomPlayer } from './room'
import { IPL_TEAMS } from './teams'
// import { auctionPool, AuctionPlayer } from './auctionPool'

const app = express()
app.use(cors())

export type Role = 'BAT' | 'BOWL' | 'AR' | 'WK'
export type Category = 'MARQUEE' | 'CAPPED' | 'UNCAPPED'

export type AuctionPlayer = {
  id: string
  name: string
  role: Role
  category: Category
  basePrice: number
  rating: number
}

export const auctionPool: AuctionPlayer[] = [
  { id: 'M1', name: 'Virat Kohli', role: 'BAT', category: 'MARQUEE', basePrice: 2, rating: 92.5 },
  { id: 'M2', name: 'Jasprit Bumrah', role: 'BOWL', category: 'MARQUEE', basePrice: 2, rating: 93.1 },
  { id: 'M3', name: 'Hardik Pandya', role: 'AR', category: 'MARQUEE', basePrice: 2, rating: 91.2 },
  { id: 'M4', name: 'MS Dhoni', role: 'WK', category: 'MARQUEE', basePrice: 2, rating: 90.8 },

  { id: 'C1', name: 'Shubman Gill', role: 'BAT', category: 'CAPPED', basePrice: 1, rating: 89.4 },
  { id: 'C2', name: 'Mohammed Siraj', role: 'BOWL', category: 'CAPPED', basePrice: 1, rating: 88.6 },
  { id: 'C3', name: 'Ravindra Jadeja', role: 'AR', category: 'CAPPED', basePrice: 1, rating: 90.1 },
  { id: 'C4', name: 'Rishabh Pant', role: 'WK', category: 'CAPPED', basePrice: 1, rating: 89.9 },

  { id: 'U1', name: 'Tilak Varma', role: 'BAT', category: 'UNCAPPED', basePrice: 0.5, rating: 84.2 },
  { id: 'U2', name: 'Umran Malik', role: 'BOWL', category: 'UNCAPPED', basePrice: 0.5, rating: 83.8 },
  { id: 'U3', name: 'Washington Sundar', role: 'AR', category: 'UNCAPPED', basePrice: 0.5, rating: 85.1 },
  { id: 'U4', name: 'Jitesh Sharma', role: 'WK', category: 'UNCAPPED', basePrice: 0.5, rating: 82.6 }
]



const shuffle = <T>(arr: T[]) => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

type AuctionState = {
  currentIndex: number
  currentPlayer: AuctionPlayer | null
  currentBid: number
  highestBidder: string | null
  timer: NodeJS.Timeout | null
}

const auctionStateByRoom: Record<string, AuctionState> = {}

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

const isValidUsername = (username?: string) =>
  typeof username === 'string' && username.trim().length > 0

io.on('connection', socket => {

    socket.on('createRoom', ({ username }) => {
    if (!isValidUsername(username)) {
      socket.emit('errorMessage', 'Username is required')
      return
    }

    const roomId = randomUUID().slice(0, 6)

    const player: RoomPlayer = {
      socketId: socket.id,
      username,
      isHost: true
    }

    rooms.set(roomId, {
      roomId,
      players: [player],
      status: 'WAITING'
    })

    socket.join(roomId)
    socket.emit('roomJoined', rooms.get(roomId))
  })

socket.on('joinRoom', ({ roomId, username }) => {
if (!isValidUsername(username)) {
    socket.emit('errorMessage', 'Username is required')
    return
}

const room = rooms.get(roomId)

if (!room) {
    socket.emit('errorMessage', 'Room not found')
    return
}

if (room.players.length >= 10) {
    socket.emit('errorMessage', 'Room is full')
    return
}

if (room.status === 'STARTED') {
    socket.emit('errorMessage', 'Game already started')
    return
}

const player: RoomPlayer = {
    socketId: socket.id,
    username,
    isHost: false
}

room.players.push(player)
socket.join(roomId)

io.to(roomId).emit('roomUpdated', room)
})

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      const index = room.players.findIndex(
        p => p.socketId === socket.id
      )

      if (index !== -1) {
        const wasHost = room.players[index].isHost

        room.players.splice(index, 1)

        if (room.players.length === 0) {
          rooms.delete(roomId)
          delete auctionStateByRoom[roomId]
          return
        }

        if (wasHost) {
          room.players[0].isHost = true
        }

        io.to(roomId).emit('roomUpdated', room)
        return
      }
    }
  })

  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId)
    if (!room) return

    const host = room.players.find(p => p.socketId === socket.id)
    if (!host || !host.isHost) return

    if (room.players.length < 5) return

    const teams = shuffle(IPL_TEAMS).slice(0, room.players.length)

    room.players.forEach((player, index) => {
      player.teamName = teams[index]
      player.purse = 100
      player.playersBought = 0
      player.rating = 0
    })

    room.status = 'STARTED'

    auctionStateByRoom[roomId] = {
      currentIndex: 0,
      currentPlayer: auctionPool[0],
      currentBid: auctionPool[0].basePrice,
      highestBidder: null,
      timer: null
    }

    io.to(roomId).emit('gameStarted', room)

    io.to(roomId).emit('auctionPlayer', {
      player: auctionPool[0],
      currentBid: auctionPool[0].basePrice,
      highestBidder: null
    })
  })
})

server.listen(4000, () => {
  console.log('Server running on 4000')
})
