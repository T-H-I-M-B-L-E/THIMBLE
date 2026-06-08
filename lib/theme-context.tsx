"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  resolved: "light" | "dark"
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getResolved(theme: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return theme
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark")
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    const stored = (localStorage.getItem("t-theme") as Theme) || "light"
    setThemeState(stored)
    applyTheme(getResolved(stored))
  }, [])

  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme(getResolved("system"))
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    localStorage.setItem("t-theme", next)
    applyTheme(getResolved(next))
  }

  const resolved = getResolved(theme)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved, toggleTheme: () => setTheme(resolved === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
