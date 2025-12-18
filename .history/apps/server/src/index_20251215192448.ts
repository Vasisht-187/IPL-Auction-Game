import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { rooms, RoomPlayer } from './room'
import { IPL_TEAMS } from './teams'


const app = express()
app.use(cors())

const shuffle = <T>(arr: T[]) => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}


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

    io.to(roomId).emit('gameStarted', room)
    })


})

server.listen(4000, () => {
  console.log('Server running on 4000')
})
