"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CURRENCIES, FALLBACK_RATES, type Currency, type CurrencyCode, type RatesPayload } from "./currencies";

const STORAGE_KEY = "llovera.currency";

type Ctx = {
  currency: Currency;
  setCurrency: (code: CurrencyCode) => void;
  rate: number;
  updatedAt: number | null;
  live: boolean;
  /** tUSDC (6 decimales) → texto en la moneda elegida, p. ej. "$ 796". */
  format: (usdc: bigint | undefined, opts?: { compact?: boolean; extraDecimals?: boolean }) => string;
  /** Monto escrito en la moneda elegida → unidades de tUSDC. */
  toUsdc: (amount: number) => bigint;
};

const CurrencyContext = createContext<Ctx | null>(null);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency fuera de CurrencyProvider");
  return ctx;
}

function readStored(): CurrencyCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return CURRENCIES.some((c) => c.code === v) ? (v as CurrencyCode) : null;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>("COP");
  useEffect(() => {
    const stored = readStored();
    if (stored) setCode(stored);
  }, []);

  const { data } = useQuery({
    queryKey: ["rates"],
    queryFn: async (): Promise<RatesPayload> => {
      const res = await fetch("/api/rates");
      if (!res.ok) throw new Error("rates");
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
  });

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCode(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(() => {
    const currency = CURRENCIES.find((c) => c.code === code)!;
    const rate = data?.rates[code] ?? FALLBACK_RATES[code];
    const formatter = (decimals: number, compact: boolean) =>
      new Intl.NumberFormat(currency.locale, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: compact ? 0 : decimals,
        maximumFractionDigits: decimals,
        notation: compact ? "compact" : "standard",
      });
    return {
      currency,
      setCurrency,
      rate,
      updatedAt: data?.updatedAt ?? null,
      live: data?.live ?? false,
      format: (usdc, opts) => {
        if (usdc === undefined) return "—";
        const amount = (Number(usdc) / 1e6) * rate;
        const decimals = currency.decimals + (opts?.extraDecimals && currency.decimals > 0 ? 1 : 0);
        return formatter(decimals, !!opts?.compact).format(amount);
      },
      toUsdc: (amount) => BigInt(Math.max(0, Math.round((amount / rate) * 1e6))),
    };
  }, [code, data, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
