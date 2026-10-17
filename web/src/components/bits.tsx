"use client";

import { rainColor } from "./ValleyMap";
import { SALES_STATUS, mm } from "@/lib/format";

const TONE_STYLE = {
  ok: { color: "var(--ok)", borderColor: "color-mix(in oklab, var(--ok) 40%, transparent)" },
  warn: { color: "var(--warn)", borderColor: "color-mix(in oklab, var(--warn) 40%, transparent)" },
  off: { color: "var(--muted)", borderColor: "var(--line-2)" },
  bad: { color: "var(--bad)", borderColor: "color-mix(in oklab, var(--bad) 45%, transparent)" },
  accent: { color: "var(--accent)", borderColor: "color-mix(in oklab, var(--accent) 45%, transparent)" },
};

export function Chip({ tone = "off", children }: { tone?: keyof typeof TONE_STYLE; children: React.ReactNode }) {
  return (
    <span className="chip" style={TONE_STYLE[tone]}>
      {children}
    </span>
  );
}

export function SalesChip({ status }: { status: number }) {
  const s = SALES_STATUS[status] ?? SALES_STATUS[0];
  return <Chip tone={s.tone}>{s.label}</Chip>;
}

/** Medidor de lluvia: barra segmentada con la escala de radar y la marca del umbral. */
export function RainGauge({ rainX10, threshold, big = false }: { rainX10: number; threshold: number; big?: boolean }) {
  const max = threshold * 1.6;
  const pct = Math.min(100, (rainX10 / max) * 100);
  const mark = (threshold / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`font-data font-semibold ${big ? "text-4xl" : "text-lg"}`} style={{ color: rainX10 > 0 ? rainColor(rainX10, threshold) : "var(--ink)" }}>
          {mm(rainX10)}
          <span className="ml-1 text-sm text-muted">mm/h</span>
        </span>
        <span className="font-data text-xs text-dim">umbral {mm(threshold)}</span>
      </div>
      <div className={`relative mt-2 overflow-hidden rounded-full bg-white/[0.05] ${big ? "h-3" : "h-1.5"}`}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--r1), var(--r2), var(--r3), var(--r4), var(--r5))", backgroundSize: `${(100 / Math.max(pct, 1)) * 100}% 100%` }}
        />
        <div className="absolute inset-y-0 w-0.5 bg-ink/80" style={{ left: `${mark}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="font-data mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
