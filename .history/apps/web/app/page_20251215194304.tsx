// 'use client'

// import { useEffect, useState } from 'react'
// import { io, Socket } from 'socket.io-client'

// type Player = {
//   socketId: string
//   username: string
//   isHost: boolean
//   teamName?: string
//   purse?: number
//   playersBought?: number
// }

// type Room = {
//   roomId: string
//   players: Player[]
//   status: 'WAITING' | 'STARTED'
// }

// export default function Home() {
//   const [socket, setSocket] = useState<Socket | null>(null)
//   const [username, setUsername] = useState('')
//   const [roomId, setRoomId] = useState('')
//   const [room, setRoom] = useState<Room | null>(null)
//   const [error, setError] = useState('')

//   const isUsernameValid = username.trim().length > 0

//   useEffect(() => {
//     const s = io('http://localhost:4000')
//     setSocket(s)

//     s.on('roomJoined', (room: Room) => {
//       setError('')
//       setRoom(room)
//     })

//     s.on('roomUpdated', (room: Room) => {
//       setRoom(room)
//     })

//     s.on('gameStarted', (room: Room) => {
//       setRoom(room)
//     })

//     s.on('errorMessage', (msg: string) => {
//       setError(msg)
//     })

//     return () => {
//       s.disconnect()
//     }
//   }, [])

//   if (room) {
//     const me = room.players.find(p => p.socketId === socket?.id)
//     const isHost = me?.isHost

//     if (room.status === 'STARTED') {
//       return (
//         <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
//           <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white space-y-6">
//             <h1 className="text-2xl font-bold text-center">
//               Auction Started
//             </h1>

//             <div className="text-center">
//               <div className="text-gray-400 text-sm">Your Team</div>
//               <div className="text-4xl font-extrabold tracking-wide">
//                 {me?.teamName}
//               </div>
//             </div>

//             <div className="flex justify-between bg-gray-800 px-4 py-3 rounded">
//               <span>Purse</span>
//               <span className="font-semibold">
//                 ₹{me?.purse} Cr
//               </span>
//             </div>

//             <div className="flex justify-between bg-gray-800 px-4 py-3 rounded">
//               <span>Players Bought</span>
//               <span className="font-semibold">
//                 {me?.playersBought}/23
//               </span>
//             </div>
//           </div>
//         </div>
//       )
//     }

//     return (
//       <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
//         <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white space-y-4">
//           <div className="text-center">
//             <div className="text-sm text-gray-400">ROOM</div>
//             <div className="text-2xl font-bold tracking-widest">
//               {room.roomId}
//             </div>
//           </div>

//           <div className="space-y-2">
//             {room.players.map(p => (
//               <div
//                 key={p.socketId}
//                 className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded"
//               >
//                 <span>{p.username}</span>
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
//                 ? 'Waiting'
//                 : 'Ready'}
//             </span>
//           </div>

//           {isHost && room.players.length >= 5 && (
//             <button
//               className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-2 rounded transition"
//               onClick={() =>
//                 socket?.emit('startGame', { roomId: room.roomId })
//               }
//             >
//               Start Game
//             </button>
//           )}

//           {!isHost && (
//             <div className="text-center text-gray-500 text-sm">
//               Waiting for host to start
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

'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type Player = {
  socketId: string
  username: string
  isHost: boolean
  teamName: string
  purse: number
  playersBought: number
  rating: number
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

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState('')
  const [roomIdInput, setRoomIdInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [error, setError] = useState('')
  const [currentPlayer, setCurrentPlayer] = useState<AuctionPlayer | null>(null)
  const [currentBid, setCurrentBid] = useState(0)
  const [highestBidder, setHighestBidder] = useState<string | null>(null)
  const [timer, setTimer] = useState(15)
  const [intervalId, setIntervalId] = useState<NodeJS.Timer | null>(null)

  const me = room?.players.find(p => p.username === username)
  const isUsernameValid = username.trim().length > 0

  useEffect(() => {
    const s = io('http://localhost:4000')
    setSocket(s)

    s.on('roomJoined', (joinedRoom: Room) => {
      setError('')
      setRoom(joinedRoom)
    })

    s.on('roomUpdated', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    s.on('gameStarted', (updatedRoom: Room) => {
      setRoom(updatedRoom)
    })

    s.on('auctionPlayer', (data: { player: AuctionPlayer; currentBid: number; highestBidder: string | null }) => {
      setCurrentPlayer(data.player)
      setCurrentBid(data.currentBid)
      setHighestBidder(data.highestBidder)
      setTimer(15)
      if (intervalId) clearInterval(intervalId)
      const id = setInterval(() => setTimer(prev => prev - 1), 1000)
      setIntervalId(id)
    })

    s.on('auctionEnded', (updatedRoom: Room) => {
      setRoom(updatedRoom)
      setCurrentPlayer(null)
      if (intervalId) clearInterval(intervalId)
      alert('Auction Ended! Check ratings to see who won.')
    })

    s.on('errorMessage', (msg: string) => setError(msg))

    return () => {
      s.disconnect()
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const createRoom = () => socket?.emit('createRoom', { username })
  const joinRoom = () => socket?.emit('joinRoom', { roomId: roomIdInput.trim(), username })
  const startGame = () => socket?.emit('startGame', { roomId: room?.roomId })

  const placeBid = (amount: number) => {
    if (!socket || !me || !currentPlayer) return
    if (me.purse < currentBid + amount) return
    socket.emit('placeBid', { roomId: room?.roomId, bidAmount: currentBid + amount })
  }

  if (room && currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Room: {room.roomId}</h2>
            <p className="text-gray-400">Your Team: {me?.teamName}</p>
            <p className="text-gray-400">Your Purse: ₹{me?.purse}cr | Players Bought: {me?.playersBought}</p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col items-center">
            <h3 className="text-2xl font-bold">{currentPlayer.name}</h3>
            <p className="text-gray-400">Role: {currentPlayer.role} | Category: {currentPlayer.category}</p>
            <p className="text-gray-400">Rating: {currentPlayer.rating}</p>
            <p className="text-yellow-500 text-xl mt-2">Current Bid: ₹{currentBid}cr</p>
            <p className="text-gray-400 text-sm">Highest Bidder: {highestBidder || 'None'}</p>
            <p className="text-red-400 mt-1">Timer: {timer}s</p>

            <div className="flex space-x-4 mt-4">
              {[0.25, 0.5, 1].map(amount => (
                <button
                  key={amount}
                  onClick={() => placeBid(amount)}
                  disabled={me?.purse! < currentBid + amount}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    me?.purse! >= currentBid + amount ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  +{amount}cr
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {room.players.map(p => (
              <div key={p.socketId} className={`p-3 rounded text-center ${p.username === username ? 'bg-yellow-900' : 'bg-gray-800'}`}>
                <p className="font-medium">{p.teamName}</p>
                <p className="text-sm text-gray-400">Purse: ₹{p.purse}cr</p>
                <p className="text-sm text-gray-400">Players: {p.playersBought}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (room && !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white text-center space-y-4">
          <h2 className="text-2xl font-bold">Room: {room.roomId}</h2>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.socketId} className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded">
                <span>{p.username}</span>
                {p.isHost && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">HOST</span>}
              </div>
            ))}
          </div>
          {me?.isHost && room.players.length >= 5 && (
            <button onClick={startGame} className="mt-4 w-full py-2 bg-yellow-500 text-black rounded font-semibold hover:bg-yellow-400">
              Start Auction
            </button>
          )}
          {room.players.length < 5 && <p className="text-red-400 mt-2">Waiting for minimum 5 players to start</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 text-white space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-wide">IPL AUCTION</h1>
          <p className="text-gray-400 text-sm mt-1">Multiplayer Auction Game</p>
        </div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />

        <button
          disabled={!isUsernameValid}
          className={`w-full py-2 rounded font-semibold transition ${isUsernameValid ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          onClick={createRoom}
        >
          Create Room
        </button>

        <div className="text-center text-gray-500 text-sm">OR</div>

        <input
          className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          placeholder="Room ID"
          value={roomIdInput}
          onChange={e => setRoomIdInput(e.target.value)}
        />

        <button
          disabled={!isUsernameValid || roomIdInput.trim().length === 0}
          className={`w-full py-2 rounded font-semibold transition ${isUsernameValid && roomIdInput.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
          onClick={joinRoom}
        >
          Join Room
        </button>

        {error && <div className="text-center text-red-400 text-sm">{error}</div>}
      </div>
    </div>
  )
}

