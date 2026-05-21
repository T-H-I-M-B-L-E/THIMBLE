"use client"

import dynamic from "next/dynamic"

// Grainient is a WebGL component — load it client-side only.
// Falls back to a soft static gradient while loading so the page is
// never bare during hydration.
const Grainient = dynamic(() => import("./Grainient.jsx"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(60% 80% at 20% 30%, rgba(229,229,234,0.55), transparent 65%), " +
          "radial-gradient(50% 70% at 80% 70%, rgba(134,134,139,0.30), transparent 60%), " +
          "linear-gradient(180deg, #FFFFFF 0%, #F5F5F7 100%)",
      }}
    />
  ),
})

/**
 * Persistent global background — monochrome cloud field.
 * Black-and-white only; no chromatic accents (matches THIMBLE brand).
 */
export function GrainientBackground() {
  return (
    <div className="grainient-bg" aria-hidden>
      <Grainient
        color1="#FFFFFF"
        color2="#E5E5EA"
        color3="#86868B"
        timeSpeed={0.12}
        warpStrength={0.4}
        grainAmount={0.06}
        zoom={1}
      />
    </div>
  )
}
