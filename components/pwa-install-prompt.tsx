"use client"

import { useEffect, useState } from "react"
import { X, Download, Share, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

type Platform = "ios" | "android" | "desktop" | null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISSED_KEY = "pwa_install_dismissed"
const DISMISSED_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function getPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return "ios"
  if (/android/i.test(ua)) return "android"
  return "desktop"
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function wasDismissedRecently(): boolean {
  try {
    const val = localStorage.getItem(DISMISSED_KEY)
    if (!val) return false
    return Date.now() - parseInt(val) < DISMISSED_TTL
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
  } catch {}
}

interface PWAInstallPromptProps {
  /** "auth" = shown right after login/signup, "inapp" = shown inside the app */
  variant?: "auth" | "inapp"
  onDone?: () => void
}

export function PWAInstallPrompt({ variant = "inapp", onDone }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (wasDismissedRecently()) return

    setPlatform(getPlatform())
    setVisible(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    markDismissed()
    setVisible(false)
    onDone?.()
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true)
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        markDismissed()
        setVisible(false)
        onDone?.()
      }
      setInstalling(false)
    }
  }

  const isAuth = variant === "auth"

  return (
    <div
      className={
        isAuth
          ? "w-full rounded-xl border border-white/10 bg-white/5 p-4 mt-6"
          : "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 bg-[#111] shadow-2xl p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/web-app-manifest-192x192.png"
            alt="TVIMBLE"
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />
          <div>
            <p className="font-semibold text-sm text-white">Add TVIMBLE to your home screen</p>
            <p className="text-xs text-white/50 mt-0.5">Get the full app experience</p>
          </div>
        </div>
        <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition-colors mt-0.5">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4">
        {platform === "ios" ? (
          <div className="space-y-2">
            <p className="text-xs text-white/60">To install on iPhone / iPad:</p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">1</span>
                Tap the <Share size={13} className="inline mx-0.5 text-blue-400" /> <strong>Share</strong> button in Safari
              </li>
              <li className="flex items-center gap-2 text-xs text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">2</span>
                Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>
              </li>
              <li className="flex items-center gap-2 text-xs text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">3</span>
                Tap <Plus size={13} className="inline mx-0.5 text-blue-400" /> <strong>Add</strong> to confirm
              </li>
            </ol>
          </div>
        ) : deferredPrompt ? (
          <Button
            onClick={handleInstall}
            disabled={installing}
            className="w-full bg-white text-black hover:bg-white/90 font-medium text-sm h-9"
          >
            <Download size={14} className="mr-2" />
            {installing ? "Installing…" : "Install App"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/60">To install:</p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">1</span>
                Open the browser menu <strong>(⋮ or ···)</strong>
              </li>
              <li className="flex items-center gap-2 text-xs text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">2</span>
                Tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> or <strong>&ldquo;Install App&rdquo;</strong>
              </li>
            </ol>
          </div>
        )}
      </div>

      {!isAuth && (
        <button
          onClick={dismiss}
          className="mt-3 w-full text-xs text-white/30 hover:text-white/50 transition-colors text-center"
        >
          Not now
        </button>
      )}
    </div>
  )
}
