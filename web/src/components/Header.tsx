"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";
import { CurrencyPicker } from "./Money";

const NAV = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/asegurar", label: "Mi turno", icon: "shield" },
  { href: "/fondo", label: "Fondo", icon: "pool" },
  { href: "/estadisticas", label: "Datos", icon: "chart" },
  { href: "/oraculo", label: "Oráculo", icon: "radar" },
] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Lloverá, inicio">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        <circle cx="17" cy="17" r="16" fill="none" stroke="var(--line-2)" />
        <circle cx="17" cy="17" r="10" fill="none" stroke="var(--line-2)" />
        <path d="M17 6c4.5 6 7 9.6 7 13a7 7 0 0 1-14 0c0-3.4 2.5-7 7-13z" fill="var(--accent)" />
        <path d="M14 19.5a3 3 0 0 0 3 3" stroke="var(--accent-ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-display font-extrabold ${compact ? "hidden sm:inline text-2xl" : "text-2xl"}`}>Lloverá</span>
    </Link>
  );
}

function NavIcon({ name, active }: { name: (typeof NAV)[number]["icon"]; active: boolean }) {
  const c = active ? "var(--accent)" : "currentColor";
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common} aria-hidden>
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" fill={active ? "rgba(255,212,59,.15)" : "none"} />
          <path d="M12 8c1.8 2.4 2.8 3.8 2.8 5.2a2.8 2.8 0 0 1-5.6 0C9.2 11.8 10.2 10.4 12 8z" />
        </svg>
      );
    case "pool":
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "radar":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 12l6-6" />
        </svg>
      );
  }
}

export function Header() {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo compact />
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((n) => {
                const active = path === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${active ? "bg-white/[0.06] text-ink" : "text-muted hover:text-ink"}`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap [&_.btn]:whitespace-nowrap">
            <CurrencyPicker />
            <ConnectButton compact />
          </div>
        </div>
      </header>

      {/* Barra inferior al alcance del pulgar (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Navegación principal"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[68px] flex-col items-center justify-center gap-1 text-[12px] font-semibold ${active ? "text-accent" : "text-muted"}`}
                >
                  <NavIcon name={n.icon} active={active} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
