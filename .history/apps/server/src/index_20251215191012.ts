import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { rooms, RoomPlayer } from './rooms'

const app = express()
app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

io.on('connection', socket => {

  socket.on('createRoom', ({ username }) => {
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
    const room = rooms.get(roomId)

    if (!room) {
      socket.emit('errorMessage', 'Room not found')
      return
    }

    if (room.players.length >= 10) {
      socket.emit('errorMessage', 'Room is full')
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

})

server.listen(4000, () => {
  console.log('Server running on 4000')
})
