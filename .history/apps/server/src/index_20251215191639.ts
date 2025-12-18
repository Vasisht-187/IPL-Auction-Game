import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { randomUUID } from 'crypto'
import { rooms, RoomPlayer } from './room'

const app = express()
app.use(cors())

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

  if (!isValidUsername(username)) {
    socket.emit('errorMessage', 'Username is required')
    return
  }
  
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

})

server.listen(4000, () => {
  console.log('Server running on 4000')
})
