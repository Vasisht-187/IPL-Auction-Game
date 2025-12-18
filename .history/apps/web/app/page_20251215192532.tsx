'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type Player = {
  socketId: string
  username: string
  isHost: boolean
}

type Room = {
  roomId: string
  players: Player[]
  status: string
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')

  const isUsernameValid = username.trim().length > 0

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.on('roomJoined', (room: Room) => {
      setError('')
      setRoom(room)
    })

    s.on('roomUpdated', (room: Room) => {
      setRoom(room)
    })

    s.on('errorMessage', (msg: string) => {
      setError(msg)
    })

    return () => {
      s.disconnect()
    }
  }, [])

//   if (room) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
//         <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white">
//           <div className="text-center mb-4">
//             <div className="text-sm text-gray-400">ROOM</div>
//             <div className="text-2xl font-bold tracking-widest">
//               {room.roomId}
//             </div>
//           </div>

//           <div className="space-y-2 mb-4">
//             {room.players.map(p => (
//               <div
//                 key={p.socketId}
//                 className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
//               >
//                 <span className="font-medium">{p.username}</span>
//                 {p.isHost && (
//                   <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
//                     HOST
//                   </span>
//                 )}
//               </div>
//             ))}
//           </div>

//           <div className="flex justify-between text-sm text-gray-400">
//             <span>{room.players.length}/10 Players</span>
//             <span>
//               {room.players.length < 5
//                 ? 'Waiting for players'
//                 : 'Ready'}
//             </span>
//           </div>

//           {room.players.length < 5 && (
//             <div className="mt-3 text-center text-red-400 text-sm">
//               Minimum 5 players required to start
//             </div>
//           )}
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
//       <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white space-y-4">
//         <div className="text-center">
//           <h1 className="text-3xl font-extrabold tracking-wide">
//             IPL AUCTION
//           </h1>
//           <p className="text-gray-400 text-sm mt-1">
//             Multiplayer Auction Game
//           </p>
//         </div>

//         <input
//           className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
//           placeholder="Username"
//           value={username}
//           onChange={e => setUsername(e.target.value)}
//         />

//         <button
//           disabled={!isUsernameValid}
//           className={`w-full py-2 rounded font-semibold transition ${
//             isUsernameValid
//               ? 'bg-yellow-500 text-black hover:bg-yellow-400'
//               : 'bg-gray-700 text-gray-400 cursor-not-allowed'
//           }`}
//           onClick={() => socket?.emit('createRoom', { username })}
//         >
//           Create Room
//         </button>

//         <div className="text-center text-gray-500 text-sm">
//           OR
//         </div>

//         <input
//           className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
//           placeholder="Room ID"
//           value={roomId}
//           onChange={e => setRoomId(e.target.value)}
//         />

//         <button
//           disabled={!isUsernameValid || roomId.trim().length === 0}
//           className={`w-full py-2 rounded font-semibold transition ${
//             isUsernameValid && roomId.trim()
//               ? 'bg-blue-600 hover:bg-blue-500'
//               : 'bg-gray-700 text-gray-400 cursor-not-allowed'
//           }`}
//           onClick={() =>
//             socket?.emit('joinRoom', {
//               roomId: roomId.trim(),
//               username
//             })
//           }
//         >
//           Join Room
//         </button>

//         {error && (
//           <div className="text-center text-red-400 text-sm">
//             {error}
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }


if (room) {
  const me = room.players.find(p => p.socketId === socket?.id)
  const isHost = me?.isHost

  if (room.status === 'STARTED') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-center">
            Auction Started
          </h1>

          <div className="text-center">
            <div className="text-gray-400 text-sm">Your Team</div>
            <div className="text-3xl font-extrabold">
              {me?.teamName}
            </div>
          </div>

          <div className="flex justify-between text-lg">
            <span>Purse</span>
            <span>₹{me?.purse} Cr</span>
          </div>

          <div className="flex justify-between text-sm text-gray-400">
            <span>Players Bought</span>
            <span>{me?.playersBought}/23</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <h1 className="text-xl font-bold text-center">
          Room {room.roomId}
        </h1>

        <div className="space-y-2">
          {room.players.map(p => (
            <div
              key={p.socketId}
              className="flex justify-between bg-gray-800 px-3 py-2 rounded"
            >
              <span>{p.username}</span>
              {p.isHost && (
                <span className="text-xs bg-yellow-500 text-black px-2 rounded">
                  HOST
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-gray-400">
          {room.players.length}/10 players
        </div>

        {isHost && room.players.length >= 5 && (
          <button
            className="w-full bg-green-500 text-black py-2 rounded font-semibold"
            onClick={() =>
              socket?.emit('startGame', { roomId: room.roomId })
            }
          >
            Start Game
          </button>
        )}

        {!isHost && (
          <div className="text-center text-gray-500 text-sm">
            Waiting for host to start
          </div>
        )}
      </div>
    </div>
  )
}
