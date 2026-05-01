"use client"

import { useStore } from "@/lib/store"
import { useEffect, useState } from "react"

export function WelcomeOverlay() {
  const { hasSeenWelcome, setHasSeenWelcome } = useStore()
  const [show, setShow] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  useEffect(() => {
    if (!hasSeenWelcome) {
      setShow(true)
      setIsAnimatingOut(false)
      
      const fadeOutTimer = setTimeout(() => {
        setIsAnimatingOut(true)
      }, 1500)

      const closeTimer = setTimeout(() => {
        setShow(false)
        setHasSeenWelcome(true)
      }, 2000)

      return () => {
        clearTimeout(fadeOutTimer)
        clearTimeout(closeTimer)
      }
    }
  }, [hasSeenWelcome, setHasSeenWelcome])

  if (!show) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
        isAnimatingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center space-y-8 px-4">
        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-heading font-light text-white tracking-[0.3em] animate-blur-in">
          THIMBLE
        </h1>
        <div className="w-24 h-px bg-white/50 mx-auto animate-fade-in" style={{ animationDelay: '400ms' }} />
        <p className="text-white/60 uppercase tracking-[0.5em] text-[10px] sm:text-xs md:text-sm font-light animate-fade-in" style={{ animationDelay: '600ms' }}>
          Welcome Home
        </p>
      </div>
    </div>
  )
}
