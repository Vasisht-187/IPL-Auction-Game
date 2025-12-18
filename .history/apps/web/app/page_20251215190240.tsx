'use client'

import { useEffect } from 'react'
import { io } from 'socket.io-client'

export default function Home() {
  useEffect(() => {
    const socket = io('http://localhost:4000')
    socket.on('connect', () => {
      console.log('Connected to server')
    })
  }, [])

  return (
    <div className="p-6 text-xl">
      IPL Auction MVP
    </div>
  )
}
