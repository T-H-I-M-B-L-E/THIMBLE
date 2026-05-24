"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PostMediaProps {
  /** One or more image URLs. Empty entries are filtered. */
  images: string[]
  alt?: string
  /** Optional click handler — typically opens the lightbox. */
  onClick?: () => void
  /**
   * Containment strategy. "contain" (default) letterboxes the image so
   * its full orientation is preserved; "cover" smart-crops to fill.
   */
  fit?: "contain" | "cover"
  /** Larger size when used in lightbox vs feed. */
  variant?: "feed" | "lightbox"
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
  fit = "contain",
  variant = "feed",
}: PostMediaProps) {
  const cleaned = images.filter(Boolean)
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  // Reset index if the images array shrinks below current index
  useEffect(() => {
    if (index >= cleaned.length) setIndex(0)
  }, [cleaned.length, index])

  if (cleaned.length === 0) return null

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
      <div className="t-post-media-stage">
        <img
          src={cleaned[index]}
          alt={`${alt}${hasMany ? ` (${index + 1} of ${cleaned.length})` : ""}`}
          className="t-post-media-img"
          style={{ objectFit: fit }}
          loading="lazy"
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
