"use client";

import { useMemo } from "react";

const COLORS = ["var(--accent)", "var(--r1)", "var(--cyan)", "var(--r4)", "var(--r2)", "#ffffff"];

/** Lluvia de gotas y monedas: confeti con temática de Lloverá. Solo CSS. */
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 61) % 100,
        delay: ((i * 37) % 70) / 100,
        dur: 1.6 + ((i * 13) % 10) / 10,
        drift: ((i * 29) % 60) - 30,
        size: 7 + ((i * 7) % 8),
        kind: i % 3, // 0 gota, 1 moneda, 2 tira
        color: COLORS[i % COLORS.length],
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.kind === 2 ? p.size / 2 : p.size,
              height: p.kind === 2 ? p.size * 1.6 : p.size,
              background: p.kind === 1 ? "var(--accent)" : p.color,
              borderRadius: p.kind === 0 ? "50% 50% 50% 0" : p.kind === 1 ? "999px" : "2px",
              boxShadow: p.kind === 1 ? "inset 0 0 0 2px rgba(0,0,0,.18)" : undefined,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Spinner de nube con gotas: se usa mientras la transacción viaja a Monad. */
export function RainSpinner({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden className="rain-spinner">
      <circle cx="44" cy="44" r="40" fill="none" stroke="var(--line-2)" strokeWidth="3" />
      <circle cx="44" cy="44" r="40" fill="none" stroke="var(--cyan)" strokeWidth="3" strokeLinecap="round" strokeDasharray="60 200" className="spin-ring" />
      <path d="M28 46a10 10 0 0 1 3-19.5A13 13 0 0 1 56 30a9 9 0 0 1-1 16H28z" fill="var(--ink)" opacity=".92" />
      {[32, 42, 52].map((x, i) => (
        <line key={x} x1={x} y1="52" x2={x - 3} y2="60" stroke="var(--cyan)" strokeWidth="3" strokeLinecap="round" className="drop-fall" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </svg>
  );
}

/** Ilustración de "confirma en tu wallet": un teléfono que vibra. */
export function WalletPrompt({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden className="phone-buzz">
      <rect x="27" y="10" width="34" height="64" rx="7" fill="var(--panel-2)" stroke="var(--accent)" strokeWidth="3" />
      <rect x="33" y="20" width="22" height="30" rx="3" fill="var(--accent)" opacity=".18" />
      <path d="M38 36l5 5 9-10" stroke="var(--accent)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="35" y="58" width="18" height="7" rx="3.5" fill="var(--accent)" />
      <path d="M17 30c-4 7-4 17 0 24M71 30c4 7 4 17 0 24" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" className="buzz-waves" />
    </svg>
  );
}

export function SuccessBurst({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden className="success-pop">
      <circle cx="48" cy="48" r="44" fill="var(--ok)" opacity=".16" />
      <circle cx="48" cy="48" r="32" fill="var(--ok)" />
      <path d="M33 49l10 10 20-22" stroke="#04130e" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" className="check-draw" />
    </svg>
  );
}

export function ErrorBadge({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden className="success-pop">
      <circle cx="44" cy="44" r="40" fill="var(--warn)" opacity=".15" />
      <path d="M28 50a10 10 0 0 1 3-19.5A13 13 0 0 1 56 34a9 9 0 0 1-1 16H28z" fill="var(--warn)" />
      <circle cx="38" cy="41" r="2.5" fill="#1b0f00" />
      <circle cx="49" cy="41" r="2.5" fill="#1b0f00" />
      <path d="M37 47c3-2.5 9-2.5 12 0" stroke="#1b0f00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
