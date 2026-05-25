"use client"

import { useState } from "react"

interface TextPostProps {
  /** Body text. Whitespace and line-breaks are preserved. */
  text: string
}

const COLLAPSED_LINES = 3
const COLLAPSE_THRESHOLD_CHARS = 180

/**
 * Quote-style card for text-only posts. Renders large readable type on
 * a soft surface so the post reads as standalone content (rather than
 * looking like a thin caption with no image).
 *
 * Long text collapses to 3 lines with a Read more toggle; short text
 * skips the toggle entirely so the card hugs the content.
 */
export function TextPost({ text }: TextPostProps) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation =
    text.length > COLLAPSE_THRESHOLD_CHARS || text.split("\n").length > COLLAPSED_LINES

  return (
    <div className="t-text-post">
      <p
        className={`t-text-post-body ${expanded || !needsTruncation ? "" : "t-text-post-clamp"}`}
      >
        {text}
      </p>
      {needsTruncation && (
        <button
          type="button"
          className="t-text-post-more"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}
