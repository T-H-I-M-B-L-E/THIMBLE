"use client"

import { useEffect, useState, useRef, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Lock } from "lucide-react"

interface AuthGateProps {
  /** Children rendered behind the gate. They remain visible (blurred) once the gate engages. */
  children: ReactNode
  /** True when the viewer is authenticated. Skip the gate entirely. */
  isAuthenticated: boolean
  /** True while auth status is still being determined. Skip the gate until known. */
  isAuthLoading: boolean
  /** Seconds of free preview before the gate engages. Defaults to 5. */
  previewSeconds?: number
}

/**
 * Wraps any page in a free-preview window for unauthenticated viewers.
 *
 * After `previewSeconds`, the wrapped content is blurred + dimmed and a
 * non-dismissible modal blocks further interaction, prompting sign-in or
 * sign-up. The current path is preserved as a `?redirect=` query param so
 * the auth flow can return the user to the same post.
 *
 * For authenticated viewers (or while auth is still loading) the gate is a
 * no-op — children render normally.
 */
export function AuthGate({
  children,
  isAuthenticated,
  isAuthLoading,
  previewSeconds = 5,
}: AuthGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [gated, setGated] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Engage the gate after the preview window, but only for anon viewers.
  useEffect(() => {
    if (isAuthLoading) return
    if (isAuthenticated) {
      setGated(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    timerRef.current = setTimeout(() => setGated(true), previewSeconds * 1000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isAuthenticated, isAuthLoading, previewSeconds])

  // Lock scroll while gated to reinforce non-dismissibility.
  useEffect(() => {
    if (!gated) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [gated])

  const goToAuth = (target: "/auth" | "/auth/signup") => {
    const redirect = encodeURIComponent(pathname || "/")
    router.push(`${target}?redirect=${redirect}`)
  }

  return (
    <>
      <div
        aria-hidden={gated || undefined}
        style={{
          filter: gated ? "blur(14px)" : "none",
          transition: "filter .4s ease-out",
          pointerEvents: gated ? "none" : "auto",
          userSelect: gated ? "none" : "auto",
        }}
      >
        {children}
      </div>

      {gated && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 2200,
              animation: "t-fade-in .25s ease-out both",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-gate-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2201,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                background: "var(--t-surface)",
                border: "1px solid var(--t-line)",
                borderRadius: 18,
                padding: "32px 28px",
                maxWidth: 380,
                width: "100%",
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,.4)",
                animation: "t-confirm-pop .25s var(--motion-spring) both",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--t-gold-soft)",
                  color: "var(--t-gold-ink)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Lock size={22} strokeWidth={1.75} />
              </div>
              <h2
                id="auth-gate-title"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--t-ink)",
                  margin: "0 0 8px",
                }}
              >
                Join THIMBLE to keep viewing
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--t-ink-2)",
                  lineHeight: 1.5,
                  margin: "0 0 24px",
                }}
              >
                Create a free account to see the rest of this post, follow
                creators, and join the conversation.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => goToAuth("/auth/signup")}
                  style={{
                    padding: "12px 16px",
                    background: "var(--t-ink)",
                    color: "var(--t-bg)",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Sign up
                </button>
                <button
                  onClick={() => goToAuth("/auth")}
                  style={{
                    padding: "12px 16px",
                    background: "var(--t-surface-2)",
                    color: "var(--t-ink)",
                    border: "1px solid var(--t-line)",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Log in
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
