"use client";

import { useEffect, useRef, useState } from "react";
import { Money } from "@/components/Money";
import { Confetti } from "@/components/Celebration";
import { rainColor } from "@/components/ValleyMap";

const THRESHOLD = 15;
const PAYOUT = 3_500_000n;
const PRESETS = [
  { mm: 0, label: "☀️ Seco" },
  { mm: 4, label: "🌦️ Llovizna" },
  { mm: 10, label: "🌧️ Lluvia" },
  { mm: 24, label: "⛈️ Aguacero" },
];

function describe(mm: number) {
  if (mm === 0) return { title: "Día seco", body: "Hoy no llueve. Tu prima va al fondo que protege a todos." };
  if (mm < 2) return { title: "Llovizna", body: "Apenas unas gotas. Sigue rodando tranquilo." };
  if (mm < 6) return { title: "Lluvia ligera", body: "Se moja la calle, pero todavía se puede trabajar." };
  if (mm < THRESHOLD) return { title: "Lluvia fuerte", body: `Aún no llega a ${THRESHOLD} mm/h. Si sigue subiendo, te pagamos.` };
  return { title: "¡Aguacero!", body: "Pasó el umbral. El contrato te paga solo, en menos de un segundo." };
}

/** Mini simulador: el usuario mueve la intensidad de la lluvia y ve cuándo se activa el pago. */
export function RainSimulator() {
  const [mm, setMm] = useState(4);
  const [burst, setBurst] = useState(0);
  const prev = useRef(mm);
  const paid = mm >= THRESHOLD;

  useEffect(() => {
    if (mm >= THRESHOLD && prev.current < THRESHOLD) {
      setBurst((b) => b + 1);
      try {
        navigator.vibrate?.([40, 30, 80]);
      } catch {}
    }
    prev.current = mm;
  }, [mm]);

  const drops = Math.round((Math.min(mm, 40) / 40) * 60);
  const info = describe(mm);
  const color = mm === 0 ? "var(--dim)" : rainColor(mm * 10, THRESHOLD * 10);
  const pct = Math.min(100, (mm / 40) * 100);
  const mark = (THRESHOLD / 40) * 100;

  return (
    <div className="panel grid overflow-hidden md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Ventana con la lluvia */}
      <div
        className="relative min-h-[260px] overflow-hidden transition-[background] duration-700"
        style={{ background: `linear-gradient(180deg, ${mm >= THRESHOLD ? "#1d1533" : mm > 6 ? "#13203a" : "#0f1d36"}, var(--bg-2))` }}
        aria-hidden
      >
        <svg viewBox="0 0 300 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          <g style={{ opacity: Math.min(1, 0.25 + mm / 20), transition: "opacity .5s" }}>
            <path d="M70 80a24 24 0 0 1 8-46 32 32 0 0 1 59-6 22 22 0 0 1 34 20 20 20 0 0 1-4 32z" fill={mm >= THRESHOLD ? "#3a4366" : "#64748f"} />
            <path d="M150 100a20 20 0 0 1 7-38 27 27 0 0 1 49-5 18 18 0 0 1 28 16 17 17 0 0 1-3 27z" fill={mm >= THRESHOLD ? "#2f3756" : "#55657f"} />
          </g>
          {Array.from({ length: 60 }, (_, i) => (
            <line
              key={i}
              x1={(i * 47) % 300}
              y1={70 + ((i * 31) % 60)}
              x2={(i * 47) % 300 - 5}
              y2={84 + ((i * 31) % 60)}
              stroke="#9fdcff"
              strokeWidth="2"
              strokeLinecap="round"
              className="sim-drop"
              style={{ opacity: i < drops ? 0.75 : 0, animationDelay: `${((i * 13) % 10) / 13}s`, transition: "opacity .3s" }}
            />
          ))}
          <rect x="0" y="228" width="300" height="32" fill="#0a111f" />
          <ellipse cx="150" cy="236" rx={20 + mm * 3} ry="4" fill="var(--cyan)" opacity={Math.min(0.35, mm / 60)} />
        </svg>
        <div className="absolute bottom-10 left-5">
          <p className="font-data text-5xl font-semibold transition-colors" style={{ color }}>
            {mm}
            <span className="ml-1 text-base text-muted">mm/h</span>
          </p>
        </div>
      </div>

      {/* Controles y resultado */}
      <div className="relative p-6">
        {paid && <Confetti key={burst} count={40} />}
        <p className="eyebrow">Pruébalo tú</p>
        <h3 className="font-display mt-1 text-2xl font-extrabold">Mueve la lluvia y mira qué pasa</h3>

        <div className="mt-5">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={40}
              value={mm}
              onChange={(e) => setMm(Number(e.target.value))}
              className="big-range w-full"
              aria-label="Intensidad de la lluvia en milímetros por hora"
              style={{ accentColor: color }}
            />
          </div>
          <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${mark}%` }} />
          </div>
          <p className="font-data mt-1 text-xs text-dim" style={{ paddingLeft: `calc(${mark}% - 2.2rem)` }}>
            umbral 15 mm/h
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button key={p.mm} className={`btn btn-sm ${mm === p.mm ? "btn-accent" : "btn-ghost"}`} onClick={() => setMm(p.mm)}>
              {p.label}
            </button>
          ))}
        </div>

        <div
          className={`relative mt-5 rounded-2xl border p-4 transition-colors duration-500 ${paid ? "border-accent/60 bg-accent/10" : "border-line bg-bg/40"}`}
          aria-live="polite"
        >
          <p className="font-display text-xl font-extrabold">{info.title}</p>
          <p className="mt-1 text-muted">{info.body}</p>
          {paid && (
            <p className="success-pop mt-3 text-lg">
              Te llegan <Money value={PAYOUT} className="font-display text-3xl font-extrabold text-accent" />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
