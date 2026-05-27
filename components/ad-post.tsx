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
    <article ref={ref} className="t-post t-post-ad">
      <div className="t-post-main">
        <header className="t-post-head">
          <div className="t-post-head-meta">
            <span className="t-post-name">{ad.sponsorName}</span>
            <span className="t-post-dot">·</span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 7px",
                background: "linear-gradient(90deg, rgba(245,200,66,0.25), rgba(184,134,11,0.18))",
                border: "1px solid rgba(184,134,11,0.35)",
                borderRadius: 4,
                color: "#8a6200",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid rgba(184,134,11,0.45)",
              background: "linear-gradient(90deg, rgba(245,200,66,0.22), rgba(184,134,11,0.14))",
              color: "#7a5500",
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            Learn more <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
