"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getPostAuthPath } from "@/lib/platform";

const ROLES = [
  { num: "01", name: "Designer", value: "designer", desc: "Showcase your collections, find trusted manufacturers, and build the industry connections that take your work further." },
  { num: "02", name: "Model", value: "model", desc: "Build a verified portfolio, connect with designers and agencies, and land your next booking — all in one place." },
  { num: "03", name: "Manufacturer", value: "manufacturer", desc: "Source emerging design talent and forge long-term relationships with the brands shaping tomorrow's fashion." },
  { num: "04", name: "Photographer", value: "photographer", desc: "Find editorial clients, grow your fashion portfolio, and collaborate with designers, models, and brands worldwide." },
  { num: "05", name: "Brand", value: "brand", desc: "Discover verified creative talent, source production partners, and assemble the team that brings your vision to life." },
];

const LETTERS = [
  { l: "T", word: "Talent" },
  { l: "V", word: "Vision" },
  { l: "I", word: "Industry" },
  { l: "M", word: "Market" },
  { l: "B", word: "Brand" },
  { l: "L", word: "Legacy" },
  { l: "E", word: "Expression" },
];

const STEPS = [
  { num: "01", title: "Create your profile", desc: "Build a professional profile that tells your story — showcase your work, your role, and what you bring to the fashion world." },
  { num: "02", title: "Connect with the industry", desc: "Discover and follow designers, brands, models, photographers, and manufacturers from across the globe — all verified." },
  { num: "03", title: "Collaborate and grow", desc: "Post opportunities, respond to briefs, and build the kind of collaborations that shape careers and define collections." },
];

const TICKER = ["Designers", "Models", "Manufacturers", "Photographers", "Fashion Brands", "Collaborate", "Create", "Connect", "Grow"];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    router.push(getPostAuthPath(user));
  }, [user, isLoading, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-reveal: add .tv-visible when elements enter the viewport
  useEffect(() => {
    if (isLoading || user) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("tv-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".tv-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [isLoading, user]);

  const goSignup = () => router.push("/auth/signup");
  const scrollToHow = () =>
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-[#c49a28]" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="tv-root">
      {/* ── NAV ── */}
      <nav className={`tv-nav ${scrolled ? "tv-nav-scrolled" : ""}`}>
        <button onClick={() => router.push("/")} className="tv-logo" aria-label="Tvimble home">
          T<span className="tv-logo-v">V</span>IMBLE
        </button>
        <div className="tv-nav-right">
          <button onClick={() => router.push("/auth")} className="tv-nav-link">Sign In</button>
          <button onClick={() => router.push("/upload")} className="tv-nav-link">+ Post</button>
          <button onClick={goSignup} className="tv-nav-btn">Join Free →</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="tv-hero">
        <div className="tv-hero-content">
          <p className="tv-overline">The Fashion Creative Platform</p>
          <h1 className="tv-headline">
            Where fashion<br />meets its own<br />
            <span className="tv-accent-word">
              world.
              <svg viewBox="0 0 260 18" fill="none" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 12 C60 4, 200 4, 256 12" stroke="#c49a28" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="tv-hero-sub">
            Designers, Models, Manufacturers, Photographers and Fashion Brands — all in one
            trusted platform built to make collaboration effortless.
          </p>
          <div className="tv-hero-actions">
            <button onClick={goSignup} className="tv-btn-gold">Join Tvimble — It&apos;s Free →</button>
            <button onClick={scrollToHow} className="tv-btn-outline">See How It Works ↓</button>
          </div>
        </div>
        <div className="tv-hero-letters" aria-hidden="true">
          {LETTERS.map((x, i) => (
            <span key={x.l} className="tv-big-letter" style={{ animationDelay: `${0.7 + i * 0.16}s` }}>
              {x.l}
            </span>
          ))}
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="tv-ticker" aria-hidden="true">
        <div className="tv-ticker-track">
          {[...TICKER, ...TICKER, ...TICKER, ...TICKER, ...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="tv-t-item">
              {item} <span className="tv-t-star">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── LETTER BAND ── */}
      <section className="tv-letter-band" aria-hidden="true">
        <div className="tv-letter-band-grid">
          {LETTERS.map((x) => (
            <div key={x.l} className="tv-lc">
              <span className="tv-lc-letter">{x.l}</span>
              <span className="tv-lc-word">{x.word}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROLES ── */}
      <section id="roles" className="tv-roles">
        <div className="tv-roles-header">
          <p className="tv-section-tag tv-reveal">Built for every creative</p>
          <h2 className="tv-section-title tv-reveal tv-d1">One platform.<br />Every role in fashion.</h2>
        </div>
        <div className="tv-roles-grid">
          {ROLES.map((r, i) => (
            <div key={r.value} className={`tv-role-card tv-reveal tv-d${i}`}>
              <div className="tv-role-num">{r.num}</div>
              <div className="tv-role-name">{r.name}</div>
              <p className="tv-role-desc">{r.desc}</p>
              <button onClick={goSignup} className="tv-role-cta">Explore →</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="tv-how">
        <div className="tv-how-inner">
          <div>
            <p className="tv-section-tag tv-reveal">Simple by design</p>
            <h2 className="tv-section-title tv-reveal tv-d1">How<br />Tvimble<br />works.</h2>
          </div>
          <div className="tv-steps-list">
            {STEPS.map((s, i) => (
              <div key={s.num} className={`tv-step tv-reveal tv-d${i}`}>
                <div className="tv-step-num">{s.num}</div>
                <div>
                  <div className="tv-step-title">{s.title}</div>
                  <p className="tv-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE ── */}
      <div className="tv-quote-band">
        <div className="tv-quote-mark tv-reveal">&ldquo;</div>
        <p className="tv-quote-text tv-reveal tv-d1">
          Fashion is not something that exists in dresses only. It is in the sky, in the street —
          and now, it has its own world.
        </p>
        <p className="tv-quote-attr tv-reveal tv-d2">Tvimble — Where it all comes together</p>
      </div>

      {/* ── CTA ── */}
      <section id="cta" className="tv-cta">
        <p className="tv-cta-tag tv-reveal">Start today — it&apos;s free</p>
        <h2 className="tv-cta-title tv-reveal tv-d1">Your fashion world<br />starts here.</h2>
        <p className="tv-cta-sub tv-reveal tv-d2">
          Join the creatives already building connections, booking collaborations, and shaping the
          future of fashion.
        </p>
        <div className="tv-cta-actions tv-reveal tv-d3">
          <button onClick={goSignup} className="tv-btn-gold-lg">Join Tvimble — It&apos;s Free →</button>
          <button onClick={() => router.push("/auth")} className="tv-btn-outline tv-btn-outline-lg">Sign In</button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="tv-footer">
        <div className="tv-footer-logo">T<span>V</span>IMBLE</div>
        <div className="tv-footer-copy">© {new Date().getFullYear()} Tvimble. All rights reserved.</div>
        <div className="tv-footer-links">
          <button onClick={() => router.push("/about")}>About</button>
          <button onClick={() => router.push("/help")}>Help</button>
          <button onClick={() => router.push("/terms")}>Terms</button>
          <a href="mailto:support@tvimble.tech">Contact</a>
        </div>
      </footer>
    </div>
  );
}
