
export type RoomPlayer = {
  socketId: string
  username: string
  isHost: boolean
  teamName?: string
  purse?: number
  playersBought?: number
  rating?: number
  boughtPlayers?: {
    id: string
    name: string
    role: string
    category: string
    basePrice: number
    rating: number
  }[]
}

export type Room = {
  roomId: string
  players: RoomPlayer[]
  status: 'WAITING' | 'STARTED'
}
  
export const rooms = new Map<string, Room>()
