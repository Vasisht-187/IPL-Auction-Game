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
