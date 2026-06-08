"use client"

import { useEffect, useState } from "react"
import { X, ChevronRight, ChevronLeft } from "lucide-react"

export interface HowToStep {
  icon: string
  title: string
  body: string
}

interface HowToProps {
  id: string           // unique key — stored in localStorage so it only shows once
  steps: HowToStep[]
  title?: string
}

export function HowTo({ id, steps, title = "How it works" }: HowToProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem(`howto-seen:${id}`)) {
        // Small delay so the page content renders first
        const t = setTimeout(() => setVisible(true), 600)
        return () => clearTimeout(t)
      }
    } catch { /* localStorage unavailable */ }
  }, [id])

  const dismiss = () => {
    try { localStorage.setItem(`howto-seen:${id}`, "1") } catch {}
    setVisible(false)
  }

  if (!visible) return null

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="t-howto-backdrop" onClick={dismiss}>
      <div className="t-howto-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="t-howto-header">
          <span className="t-howto-label">{title}</span>
          <button className="t-howto-close" onClick={dismiss} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>

        {/* Step content */}
        <div className="t-howto-body">
          <div className="t-howto-icon">{current.icon}</div>
          <h3 className="t-howto-step-title">{current.title}</h3>
          <p className="t-howto-step-body">{current.body}</p>
        </div>

        {/* Progress dots */}
        {steps.length > 1 && (
          <div className="t-howto-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`t-howto-dot${i === step ? " on" : ""}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="t-howto-nav">
          {step > 0 ? (
            <button className="t-howto-btn secondary" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={15} /> Back
            </button>
          ) : (
            <div />
          )}
          {isLast ? (
            <button className="t-howto-btn primary" onClick={dismiss}>
              Got it!
            </button>
          ) : (
            <button className="t-howto-btn primary" onClick={() => setStep(s => s + 1)}>
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
