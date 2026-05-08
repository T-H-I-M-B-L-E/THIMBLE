"use client"

import Image from "next/image"

export function RightRail() {
  return (
    <aside className="t-rail">
      <div className="t-rail-section">
        <div className="t-rail-greet">Today</div>
        <div className="t-rail-stat-row">
          <div className="t-stat">
            <div className="t-stat-num">12</div>
            <div className="t-stat-lab">Profile views</div>
          </div>
          <div className="t-stat">
            <div className="t-stat-num">3</div>
            <div className="t-stat-lab">New followers</div>
          </div>
          <div className="t-stat">
            <div className="t-stat-num">2</div>
            <div className="t-stat-lab">Gig replies</div>
          </div>
        </div>
      </div>

      <div className="t-rail-section">
        <div className="t-rail-h">People you might know</div>
        <ul className="t-suggest">
          {[
            { name: "Atelier Nord", role: "Brand", city: "Oslo", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&h=120&fit=crop" },
            { name: "Yusuf Demir", role: "Photographer", city: "Istanbul", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop" },
            { name: "Studio Calma", role: "Designer", city: "Porto", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop" },
          ].map((person) => (
            <li key={person.name}>
              <Image
                src={person.avatar}
                alt={person.name}
                width={32}
                height={32}
                className="t-avatar-sm"
                style={{ borderRadius: "50%" }}
              />
              <div className="t-suggest-meta">
                <div className="t-strong" style={{ fontSize: "13px" }}>{person.name}</div>
                <div className="t-muted-xs">{person.role} · {person.city}</div>
              </div>
              <button style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 500, color: "var(--t-gold-ink)", background: "none", border: 0, cursor: "pointer" }}>
                Follow
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="t-rail-section">
        <div className="t-rail-h">Trending tags</div>
        <ul className="t-trending">
          {[
            { tag: "natural-dye", count: 1240 },
            { tag: "small-batch", count: 892 },
            { tag: "studio-share", count: 614 },
            { tag: "open-call", count: 387 },
          ].map((t) => (
            <li key={t.tag}>
              <span style={{ cursor: "pointer" }}>#{t.tag}</span>
              <span className="t-muted-xs">{t.count.toLocaleString()} posts</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="t-rail-foot">
        <span>About</span>
        <span>·</span>
        <span>Help</span>
        <span>·</span>
        <span>Terms</span>
        <span>·</span>
        <span>© Thimble</span>
      </div>
    </aside>
  )
}
