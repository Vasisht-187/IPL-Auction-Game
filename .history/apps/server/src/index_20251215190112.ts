import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

io.on('connection', socket => {
  console.log('User connected', socket.id)
})

server.listen(4000, () => {
  console.log('Server running on 4000')
})
