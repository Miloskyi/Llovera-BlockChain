"use client";

import { useRef } from "react";
import { useInView } from "./Reveal";
import { Money } from "@/components/Money";

const ICONS = {
  pin: (
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="currentColor" />
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zm-1.2 12.3l5.3-5.3-1.4-1.4-3.9 3.9-1.9-1.9-1.4 1.4z" fill="currentColor" />,
  cloud: (
    <>
      <path d="M7 15a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.3 1.3A3.5 3.5 0 0 1 17.5 15z" fill="currentColor" />
      <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="M12 7v10M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.1-1 2-2.5 2-1.2 0-2.1-.5-2.6-1.3" stroke="#1b1400" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
};

const STEPS = [
  { time: "6:12 a. m.", title: "Arrancas el turno", icon: "pin", color: "var(--cyan)", body: "El GPS detecta que estás en Laureles y te ofrece la cobertura de esa zona." },
  { time: "6:13 a. m.", title: "Te aseguras", icon: "shield", color: "var(--r2)", body: "Pagas la prima con un toque en MetaMask. En una hora la cobertura queda activa." },
  { time: "3:47 p. m.", title: "Cae el aguacero", icon: "cloud", color: "var(--r5)", body: "El oráculo mide 18,2 mm/h en Laureles y lo publica en Monad." },
  { time: "3:47 p. m.", title: "Te llega la plata", icon: "coin", color: "var(--accent)", body: "pay" },
] as const;

export function DayTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, 0.25);
  return (
    <div ref={ref} className={`relative ${shown ? "in" : ""}`}>
      {/* Línea que se dibuja: horizontal en escritorio, vertical en el celular */}
      <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-line md:left-6 md:right-6 md:top-[27px] md:bottom-auto md:h-0.5 md:w-auto" aria-hidden>
        <div className="day-line h-full w-full" style={{ background: "linear-gradient(90deg, var(--cyan), var(--r2), var(--r5), var(--accent))" }} />
      </div>
      <ol className="relative grid gap-6 md:grid-cols-4 md:gap-4">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="reveal flex gap-4 md:block"
            style={{ transitionDelay: `${300 + i * 260}ms`, ...(shown ? { opacity: 1, transform: "none" } : {}) }}
          >
            <span
              className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 bg-bg"
              style={{ borderColor: s.color, color: s.color, boxShadow: `0 0 24px -6px ${s.color}` }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
                {ICONS[s.icon]}
              </svg>
            </span>
            <div className="md:mt-4">
              <p className="font-data text-sm" style={{ color: s.color }}>
                {s.time}
                {i === 3 && " + 0,4 s"}
              </p>
              <h3 className="font-display mt-1 text-xl font-bold">{s.title}</h3>
              <p className="mt-1 text-[15px] text-muted">
                {s.body === "pay" ? (
                  <>
                    En el mismo bloque, el contrato te envía <Money value={3_500_000n} className="font-semibold text-accent" />. Sin reclamos ni papeleo.
                  </>
                ) : (
                  s.body
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
