"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>("light")

  // Apple-inspired light-only aesthetic. Strip any prior `.dark` class so
  // the new glass system always renders against a light Grainient backdrop.
  useEffect(() => {
    document.documentElement.classList.remove("dark")
    try { localStorage.setItem("theme", "light") } catch {}
  }, [])

  const toggleTheme = () => {
    /* no-op — theming is locked to light for the new design system */
  }

  // Prevent flash of wrong theme - still render children with context
  // to avoid "useTheme must be used within ThemeProvider" errors during SSR

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
