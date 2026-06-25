"use client"

import { useState, useRef, useEffect } from "react"
import NextImage from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PostMediaProps {
  /** One or more image URLs. Empty entries are filtered. */
  images: string[]
  alt?: string
  /** Optional click handler — typically opens the lightbox. */
  onClick?: () => void
  /**
   * Containment strategy. "cover" (default) center-crops to fill the
   * snapped aspect ratio, Instagram-style. "contain" preserves the full
   * image with letterbox bars — used by the lightbox.
   */
  fit?: "contain" | "cover"
  /** Larger size when used in lightbox vs feed. */
  variant?: "feed" | "lightbox"
}

// Instagram's three supported aspect ratios for feed media.
const ASPECTS = {
  portrait: 4 / 5,        // 0.80
  square: 1,              // 1.00
  landscape: 1.91,        // 1.91
} as const

/**
 * Pick the closest Instagram-spec aspect ratio for a given image. We
 * commit to one ratio per *carousel* (the first image's ratio) so the
 * frame doesn't jump as the user swipes through.
 */
function snapAspect(width: number, height: number): number {
  if (!width || !height) return ASPECTS.square
  const ratio = width / height
  // Distance from each canonical ratio
  const d = {
    portrait: Math.abs(ratio - ASPECTS.portrait),
    square: Math.abs(ratio - ASPECTS.square),
    landscape: Math.abs(ratio - ASPECTS.landscape),
  }
  const min = Math.min(d.portrait, d.square, d.landscape)
  if (min === d.portrait) return ASPECTS.portrait
  if (min === d.landscape) return ASPECTS.landscape
  return ASPECTS.square
}

/**
 * Letterboxed image carousel. Works for single or multiple images.
 *
 * - Single image: renders without dots/arrows.
 * - Multiple images: swipe gesture + dot indicators + on-hover arrows.
 *
 * The container has a fixed aspect ratio so the post height is consistent
 * regardless of image orientation. The image itself uses object-fit:
 * contain so portrait/landscape/square shots are all shown in full —
 * never cropped — with a soft fill behind any bars.
 */
export function PostMedia({
  images,
  alt = "Post",
  onClick,
  fit,
  variant = "feed",
}: PostMediaProps) {
  const cleaned = images.filter(Boolean)
  const [index, setIndex] = useState(0)
  const [aspect, setAspect] = useState<number>(ASPECTS.square)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  // Reset index if the images array shrinks below current index
  useEffect(() => {
    if (index >= cleaned.length) setIndex(0)
  }, [cleaned.length, index])

  // Probe the FIRST image's natural dimensions and snap to the closest
  // canonical aspect. We lock the frame to that aspect for the whole
  // carousel so swiping doesn't make the layout jump.
  useEffect(() => {
    if (variant === "lightbox") return
    const first = cleaned[0]
    if (!first) return
    const img = new Image()
    img.onload = () => setAspect(snapAspect(img.naturalWidth, img.naturalHeight))
    img.src = first
  }, [cleaned[0], variant])

  if (cleaned.length === 0) return null

  // Default fit: cover in feed (uniform frame), contain in lightbox.
  const resolvedFit: "cover" | "contain" =
    fit ?? (variant === "lightbox" ? "contain" : "cover")

  const hasMany = cleaned.length > 1
  const go = (dir: -1 | 1, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setIndex(i => (i + dir + cleaned.length) % cleaned.length)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }
  const onTouchEnd = () => {
    if (!hasMany || touchStartX.current === null || touchEndX.current === null) return
    const dx = touchStartX.current - touchEndX.current
    if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1)
    touchStartX.current = null
    touchEndX.current = null
  }

  return (
    <div
      className={`t-post-media ${variant === "lightbox" ? "t-post-media--lb" : ""}`}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? "View post" : undefined}
    >
      <div
        className="t-post-media-stage"
        style={variant === "lightbox" ? undefined : { aspectRatio: aspect }}
      >
        <NextImage
          src={cleaned[index]}
          alt={`${alt}${hasMany ? ` (${index + 1} of ${cleaned.length})` : ""}`}
          className="t-post-media-img"
          fill
          style={{ objectFit: resolvedFit }}
          sizes={variant === "lightbox"
            ? "100vw"
            : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"}
          priority={index === 0 && variant === "feed"}
        />
      </div>

      {hasMany && (
        <>
          <button
            type="button"
            className="t-post-media-arrow t-post-media-arrow-prev"
            onClick={e => go(-1, e)}
            aria-label="Previous image"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="t-post-media-arrow t-post-media-arrow-next"
            onClick={e => go(1, e)}
            aria-label="Next image"
          >
            <ChevronRight size={18} />
          </button>

          <div className="t-post-media-dots" aria-hidden="true">
            {cleaned.map((_, i) => (
              <span
                key={i}
                className={`t-post-media-dot ${i === index ? "on" : ""}`}
              />
            ))}
          </div>

          <div className="t-post-media-count" aria-live="polite">
            {index + 1} / {cleaned.length}
          </div>
        </>
      )}
    </div>
  )
}
