"use client"

import { useState } from "react"

interface PostCaptionProps {
  text: string
  /** Author name rendered inline before the caption, Instagram-style. */
  authorName?: string
}

const COLLAPSED_LINES = 3
const COLLAPSE_THRESHOLD_CHARS = 150

/**
 * Caption that appears under image posts. Inline author + body text,
 * clamped to 3 lines (or ~150 chars) with a "more" toggle. Independent
 * from <TextPost> because the typography and chrome differ.
 */
export function PostCaption({ text, authorName }: PostCaptionProps) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = text.trim()
  if (!trimmed) return null

  const needsTruncation =
    trimmed.length > COLLAPSE_THRESHOLD_CHARS || trimmed.split("\n").length > COLLAPSED_LINES

  return (
    <p className="t-post-caption">
      {authorName && <span className="t-post-caption-author">{authorName}</span>}
      <span
        className={
          expanded || !needsTruncation
            ? "t-post-caption-body"
            : "t-post-caption-body t-post-caption-clamp"
        }
      >
        {trimmed}
      </span>
      {needsTruncation && (
        <button
          type="button"
          className="t-post-caption-more"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </p>
  )
}
