import { loadPlayersFromExcel } from './dataLoader'

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

export const auctionPool: AuctionPlayer[] = loadPlayersFromExcel()

