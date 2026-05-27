"use client";

import { useRef, useEffect } from "react";
import { ExternalLink } from "lucide-react";

export interface AdData {
  id: string;
  title: string;
  sponsorName: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  redirectUrl: string;
  placement: string;
  isActive: boolean;
  clickCount: number;
  impressionCount: number;
}

interface AdPostProps {
  ad: AdData;
}

export function AdPost({ ad }: AdPostProps) {
  const ref = useRef<HTMLElement>(null);
  const reported = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reported.current) {
          reported.current = true;
          fetch(`/api/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {});
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id]);

  const ensureAbsolute = (url: string) =>
    url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;

  const handleClick = async () => {
    let target = ensureAbsolute(ad.redirectUrl);
    try {
      const res = await fetch(`/api/ads/${ad.id}/click`, { method: "POST" });
      if (res.ok) {
        const { redirectUrl } = await res.json();
        target = ensureAbsolute(redirectUrl);
      }
    } catch {
      /* fall through */
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <article ref={ref} className="t-post">
      <div className="t-post-main">
        <header className="t-post-head">
          <div className="t-post-head-meta">
            <span className="t-post-name">{ad.sponsorName}</span>
            <span className="t-post-dot">·</span>
            <span
              className="t-muted-xs"
              style={{
                fontSize: 11,
                padding: "1px 6px",
                background: "var(--t-surface-2)",
                borderRadius: 4,
                color: "var(--t-ink-3)",
                fontWeight: 500,
                letterSpacing: "0.04em",
              }}
            >
              Sponsored
            </span>
          </div>
        </header>

        {ad.imageUrl && (
          <button
            onClick={handleClick}
            type="button"
            style={{
              display: "block",
              width: "100%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: "none",
            }}
          >
            <img
              src={ad.imageUrl}
              alt={ad.title}
              style={{
                width: "100%",
                borderRadius: 8,
                display: "block",
                objectFit: "cover",
                maxHeight: 480,
              }}
            />
          </button>
        )}

        <div style={{ marginTop: 8 }}>
          <p
            className="t-strong"
            style={{ fontSize: 14, marginBottom: 2 }}
          >
            {ad.title}
          </p>
          {ad.description && (
            <p style={{ fontSize: 13, color: "var(--t-ink-2)", marginBottom: 8 }}>
              {ad.description}
            </p>
          )}
          <button
            onClick={handleClick}
            type="button"
            className="t-btn-primary"
            style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Learn more <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
