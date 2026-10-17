"use client";

import { useState } from "react";
import { useCurrency } from "@/lib/currency";
import { CURRENCIES } from "@/lib/currencies";
import { usd } from "@/lib/format";
import { Sheet } from "./Sheet";

/** Monto en la moneda que eligió el usuario. Muestra un esqueleto animado mientras carga. */
export function Money({ value, className = "", extraDecimals }: { value: bigint | undefined; className?: string; extraDecimals?: boolean }) {
  const { format } = useCurrency();
  if (value === undefined) return <span className={`skeleton ${className}`}>000,00</span>;
  return <span className={className}>{format(value, { extraDecimals })}</span>;
}

/** Equivalencia en tUSDC, para quien quiera ver el valor real en la cadena. */
export function UsdcNote({ value, className = "" }: { value: bigint | undefined; className?: string }) {
  const { currency } = useCurrency();
  if (value === undefined || currency.code === "USD") return null;
  return <span className={`font-data text-xs text-dim ${className}`}>≈ {usd(value)} tUSDC</span>;
}

export function RateLine({ className = "" }: { className?: string }) {
  const { currency, rate, updatedAt, live } = useCurrency();
  if (currency.code === "USD") return <p className={`text-xs text-dim ${className}`}>1 tUSDC = 1 dólar.</p>;
  const date = updatedAt ? new Date(updatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : null;
  return (
    <p className={`text-xs text-dim ${className}`}>
      Tasa del día: 1 USD = {rate.toLocaleString(currency.locale, { maximumFractionDigits: 2 })} {currency.code}
      {live && date ? ` · ${date}` : " · aproximada"}
    </p>
  );
}

/** Botón compacto con la moneda actual que abre la lista de monedas. */
export function CurrencyPicker({ className = "" }: { className?: string }) {
  const { currency, setCurrency, format } = useCurrency();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={`flex h-10 items-center gap-1.5 rounded-xl border border-line-2 px-2.5 text-sm font-semibold transition hover:border-muted ${className}`}
        onClick={() => setOpen(true)}
        aria-label={`Moneda: ${currency.name}. Cambiar moneda`}
      >
        <span className="font-data">{currency.code}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Elegir moneda">
        <h2 className="font-display text-2xl font-extrabold">¿En qué moneda quieres ver todo?</h2>
        <p className="mt-1 text-sm text-muted">
          Convertimos con la tasa del día. Ejemplo: la cobertura diaria cuesta <b className="text-ink">{format(250000n, { extraDecimals: true })}</b>.
        </p>
        <ul className="mt-5 grid max-h-[55vh] gap-2 overflow-y-auto">
          {CURRENCIES.map((c) => {
            const active = c.code === currency.code;
            return (
              <li key={c.code}>
                <button
                  onClick={() => {
                    setCurrency(c.code);
                    setOpen(false);
                  }}
                  className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                    active ? "border-accent bg-accent/10" : "border-line hover:border-line-2"
                  }`}
                  aria-pressed={active}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-xl" aria-hidden>
                    {c.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{c.name}</span>
                    <span className="font-data text-xs text-muted">{c.code}</span>
                  </span>
                  {active && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink" aria-label="Moneda actual">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <RateLine className="mt-4" />
        <p className="mt-1 text-[11px] text-dim">
          Tasas:{" "}
          <a className="underline" href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">
            ExchangeRate-API
          </a>
        </p>
      </Sheet>
    </>
  );
}
