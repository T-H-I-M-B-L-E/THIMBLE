"use client";

import { useState, useEffect, useRef } from "react";
import { Share2, Copy, Mail, Send, ChevronDown, ChevronUp } from "lucide-react";

interface SharePopoverProps {
  postId: string | number;
  postUrl: string;
  title?: string;
}

async function logShare(
  postId: string | number,
  platform: string,
  toUserId?: string,
  note?: string,
) {
  try {
    await fetch(`/api/posts/${postId}/share`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, toUserId, note }),
    });
  } catch {
    // non-fatal
  }
}

export function SharePopover({
  postId,
  postUrl,
  title = "Check out this post on THIMBLE",
}: SharePopoverProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const encodedUrl = encodeURIComponent(postUrl);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      id: "twitter",
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
    },
    {
      id: "email",
      label: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
      icon: <Mail size={15} />,
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShare(postId, "copy");
    } catch {
      /* clipboard may be blocked */
    }
  };

  const handlePlatformClick = (platformId: string) => {
    logShare(postId, platformId);
  };

  const handleInternalSend = async () => {
    if (!recipient.trim() || sending) return;
    setSending(true);
    await logShare(
      postId,
      "internal",
      recipient.trim(),
      note.trim() || undefined,
    );
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setShowInternal(false);
      setRecipient("");
      setNote("");
      setOpen(false);
    }, 1800);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        className="t-action"
        onClick={() => setOpen((s) => !s)}
        aria-label="Share post"
        aria-expanded={open}
        type="button"
      >
        <Share2 size={16} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share options"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--t-surface)",
            border: "1px solid var(--t-line)",
            borderRadius: 16,
            padding: 14,
            width: 230,
            zIndex: 200,
            boxShadow: "0 8px 32px rgba(20,16,40,.14)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Copy link */}
          <button
            onClick={copyLink}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 9,
              border: "1px solid var(--t-line)",
              background: copied ? "var(--t-gold-soft)" : "var(--t-surface-2)",
              color: "var(--t-ink)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              marginBottom: 10,
              transition: "background .15s",
              fontFamily: "inherit",
            }}
          >
            <Copy size={14} />
            {copied ? "Copied!" : "Copy link"}
          </button>

          {/* External platforms */}
          <p
            style={{
              fontSize: 11,
              color: "var(--t-ink-3)",
              marginBottom: 6,
              paddingLeft: 2,
            }}
          >
            Share to
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: 10,
            }}
          >
            {platforms.map((p) => (
              <a
                key={p.id}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handlePlatformClick(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 8,
                  color: "var(--t-ink-2)",
                  textDecoration: "none",
                  fontSize: 13,
                  transition: "background .12s, color .12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--t-surface-2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--t-ink)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--t-ink-2)";
                }}
              >
                {p.icon}
                {p.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div
            style={{ borderTop: "1px solid var(--t-line)", margin: "8px 0" }}
          />

          {/* Internal share toggle */}
          <button
            type="button"
            onClick={() => setShowInternal((s) => !s)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: "var(--t-ink-2)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Send size={14} />
              Share with a user
            </span>
            {showInternal ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showInternal && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                type="text"
                placeholder="Username or user ID"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--t-line)",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <textarea
                placeholder="Add a note… (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                rows={2}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--t-line)",
                  background: "var(--t-surface-2)",
                  color: "var(--t-ink)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={handleInternalSend}
                disabled={!recipient.trim() || sending || sent}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: sent ? "var(--t-gold-soft)" : "var(--t-ink)",
                  color: sent ? "var(--t-gold-ink)" : "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    recipient.trim() && !sending && !sent
                      ? "pointer"
                      : "default",
                  opacity: !recipient.trim() ? 0.5 : 1,
                  transition: "background .15s",
                  fontFamily: "inherit",
                }}
              >
                {sent ? "Sent!" : sending ? "Sending…" : "Send"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SharePopover;
