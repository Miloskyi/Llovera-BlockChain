"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RURAL_GEO, ZONE_GEO, type Ring } from "@/lib/geo";

export type MapZone = {
  rainX10: number;
  storming: boolean;
  insured: boolean;
};

export type MapFocus = "valle" | "medellin" | "norte" | "sur" | { zone: number };

export type MapPoint = { lon: number; lat: number; simulated?: boolean };

// ── Proyección equirectangular corregida por latitud ──
const K = Math.cos((6.25 * Math.PI) / 180);
const S = 1000;
const LON0 = -75.73;
const LAT1 = 6.525;
const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * K * S, (LAT1 - lat) * S];
const unproject = (x: number, y: number) => ({ lon: x / (K * S) + LON0, lat: LAT1 - y / S });

const ringPath = (ring: Ring) =>
  ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("") + "Z";

const ZONE_PATHS = ZONE_GEO.map((z) => z.rings.map(ringPath).join(""));
const RURAL_PATHS = RURAL_GEO.map((r) => r.rings.map(ringPath).join(""));
const LABELS = ZONE_GEO.map((z) => project(z.label[0], z.label[1]));

// Trazado aproximado del río Medellín (Aburrá), de sur a norte.
const RIVER = [
  [-75.636, 5.99], [-75.631, 6.06], [-75.624, 6.11], [-75.612, 6.148], [-75.594, 6.184], [-75.58, 6.222], [-75.573, 6.255],
  [-75.568, 6.285], [-75.556, 6.318], [-75.528, 6.343], [-75.488, 6.362], [-75.44, 6.388], [-75.385, 6.428], [-75.32, 6.468], [-75.25, 6.505],
]
  .map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join("");

type Box = [number, number, number, number]; // x, y, w, h

function bboxOf(ids: number[], pad = 0.08, min = 40): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of ids)
    for (const ring of ZONE_GEO[id].rings)
      for (const [lon, lat] of ring) {
        const [x, y] = project(lon, lat);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  let w = Math.max(x1 - x0, min);
  let h = Math.max(y1 - y0, min);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  w *= 1 + pad * 2;
  h *= 1 + pad * 2;
  // Mantener proporción cercana a 1:1.1 para que el contenedor no cambie de forma.
  const ratio = 1.08;
  if (h / w < ratio) h = w * ratio;
  else w = h / ratio;
  return [cx - w / 2, cy - h / 2, w, h];
}

const ALL = ZONE_GEO.map((z) => z.id);
const PRESETS: Record<"valle" | "medellin" | "norte" | "sur", Box> = {
  valle: bboxOf(ALL, 0.03),
  medellin: bboxOf(ALL.filter((i) => ZONE_GEO[i].area === "Medellín"), 0.06),
  norte: bboxOf(ALL.filter((i) => ZONE_GEO[i].area === "Norte"), 0.05),
  sur: bboxOf(ALL.filter((i) => ZONE_GEO[i].area === "Sur"), 0.06),
};

const focusBox = (f: MapFocus): Box => (typeof f === "string" ? PRESETS[f] : bboxOf([f.zone], 0.9, 60));

/** Color de la escala de radar según la lluvia relativa al umbral. */
// Cortes de la escala como fracción del umbral (con umbral 15 mm/h: 0.5 · 2 · 6 · 10 · 15).
const CUTS = [1 / 30, 2 / 15, 0.4, 2 / 3, 1];

export function rainColor(rainX10: number, threshold: number) {
  const r = rainX10 / threshold;
  const level = CUTS.filter((c) => r >= c).length;
  return `var(--r${level})`;
}

export function ValleyMap({
  zones,
  threshold,
  selected = null,
  onSelect,
  focus,
  onFocusChange,
  you,
  picking = false,
  onPick,
  className = "",
  colorOf,
  hoverLabel,
  legend,
}: {
  zones: MapZone[];
  threshold: number;
  selected?: number | null;
  onSelect?: (id: number) => void;
  focus: MapFocus;
  onFocusChange?: (f: MapFocus) => void;
  you?: MapPoint | null;
  picking?: boolean;
  onPick?: (p: MapPoint) => void;
  className?: string;
  /** Pinta cada zona con otro dato (p. ej. estadísticas) en lugar de la lluvia. */
  colorOf?: (id: number) => string;
  hoverLabel?: (id: number) => string;
  legend?: React.ReactNode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box>(() => focusBox(focus));
  const [hover, setHover] = useState<number | null>(null);
  const target = useMemo(() => focusBox(focus), [focus]);
  const boxRef = useRef(box);
  boxRef.current = box;

  // Animación suave del encuadre.
  useEffect(() => {
    const from = boxRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      setBox(from.map((v, i) => v + (target[i] - v) * e) as Box);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const [bx, by, bw, bh] = box;
  const zoomedIn = bw < 260;
  const fs = bw / 46; // tamaño de fuente relativo al encuadre
  const stroke = bw / 600;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!picking || !onPick || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svgRef.current.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    onPick({ ...unproject(p.x, p.y), simulated: true });
  }

  const youXY = you ? project(you.lon, you.lat) : null;
  const hovered = hover ?? selected;

  return (
    <div className={`panel relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
        <div className="radar-sweep" />
      </div>

      {onFocusChange && (
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1 rounded-xl border border-line bg-bg/80 p-1 backdrop-blur">
          {(["valle", "medellin", "norte", "sur"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFocusChange(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                focus === f ? "bg-white/10 text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {f === "valle" ? "Valle" : f === "medellin" ? "Medellín" : f}
            </button>
          ))}
        </div>
      )}

      {hovered !== null && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-xl border border-line bg-bg/85 px-3 py-2 text-right backdrop-blur">
          <p className="font-display text-sm font-bold">{ZONE_GEO[hovered].name}</p>
          <p className="font-data text-xs text-muted">
            {hoverLabel ? hoverLabel(hovered) : `${ZONE_GEO[hovered].kind} · ${((zones[hovered]?.rainX10 ?? 0) / 10).toFixed(1)} mm/h`}
          </p>
        </div>
      )}

      {picking && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center">
          <span className="chip border-cyan/50 bg-bg/90 text-cyan">Toca el mapa para ubicarte</span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${bx} ${by} ${bw} ${bh}`}
        className={`relative block aspect-[1/1.08] w-full ${picking ? "cursor-crosshair" : ""}`}
        onClick={handleClick}
        role="img"
        aria-label="Mapa del Valle de Aburrá por zonas"
      >
        <defs>
          <pattern id="hatch" width={bw / 90} height={bw / 90} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={bw / 90} stroke="var(--accent)" strokeWidth={bw / 260} strokeOpacity="0.75" />
          </pattern>
          <pattern id="rain" width="8" height="12" patternUnits="userSpaceOnUse">
            <line x1="6" y1="0" x2="2" y2="8" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.9" className="rain-pattern-anim" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={bw / 220} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {RURAL_PATHS.map((d, i) => (
          <path key={`r${i}`} d={d} fill="var(--bg-2)" stroke="var(--line)" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 3}`} />
        ))}

        {ZONE_PATHS.map((d, i) => {
          const z = zones[i];
          const fill = colorOf ? colorOf(i) : rainColor(z?.rainX10 ?? 0, threshold);
          const dry = colorOf ? true : !z || z.rainX10 <= 0;
          const isSel = selected === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                if (picking) return;
                e.stopPropagation();
                onSelect?.(i);
              }}
              className={onSelect && !picking ? "cursor-pointer" : ""}
            >
              <path
                d={d}
                fill={fill}
                fillOpacity={dry ? 0.9 : 0.78}
                className={z?.storming ? "zone-storm" : ""}
                stroke={hover === i ? "var(--ink)" : "var(--bg)"}
                strokeWidth={stroke * (hover === i ? 2.2 : 1.4)}
                strokeLinejoin="round"
              />
              {z?.storming && <path d={d} fill="url(#rain)" pointerEvents="none" />}
              {z?.insured && <path d={d} fill="url(#hatch)" pointerEvents="none" />}
              {isSel && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={stroke * 3.2} strokeLinejoin="round" filter="url(#glow)" pointerEvents="none" />}
            </g>
          );
        })}

        <path d={RIVER} fill="none" stroke="var(--cyan)" strokeOpacity="0.55" strokeWidth={stroke * 1.6} strokeLinecap="round" pointerEvents="none" />

        {/* Etiquetas */}
        <g pointerEvents="none" style={{ paintOrder: "stroke" }} stroke="var(--bg)" strokeWidth={fs * 0.28} strokeLinejoin="round">
          {ZONE_GEO.map((z, i) => {
            const comuna = z.area === "Medellín";
            if (comuna && !zoomedIn) return null;
            const [x, y] = LABELS[i];
            const size = comuna ? fs * 0.62 : fs * (zoomedIn ? 0.62 : 0.78);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size}
                fontWeight={selected === i ? 800 : 650}
                fill={selected === i ? "var(--accent)" : "var(--ink)"}
                className="font-display"
              >
                {z.name}
              </text>
            );
          })}
          {!zoomedIn && (
            <text x={LABELS[10][0] + 8} y={LABELS[10][1]} textAnchor="middle" fontSize={fs * 1.05} fontWeight={800} fill="var(--ink)" className="font-display" letterSpacing={fs * 0.12}>
              MEDELLÍN
            </text>
          )}
        </g>

        {youXY && (
          <g pointerEvents="none">
            <circle cx={youXY[0]} cy={youXY[1]} r={4} fill="none" stroke="var(--cyan)" strokeWidth={stroke * 2} className="gps-ring" style={{ transformBox: "fill-box" }} />
            <circle cx={youXY[0]} cy={youXY[1]} r={bw / 110} fill="var(--cyan)" stroke="var(--bg)" strokeWidth={stroke * 2} />
            <text
              x={youXY[0]}
              y={youXY[1] - bw / 45}
              textAnchor="middle"
              fontSize={fs * 0.62}
              fontWeight={800}
              fill="var(--cyan)"
              stroke="var(--bg)"
              strokeWidth={fs * 0.25}
              style={{ paintOrder: "stroke" }}
              className="font-data"
            >
              {you?.simulated ? "TÚ (SIM)" : "TÚ"}
            </text>
          </g>
        )}
      </svg>

      {legend ?? <RadarLegend threshold={threshold} />}
    </div>
  );
}

export function RadarLegend({ threshold }: { threshold: number }) {
  const t = threshold / 10;
  const fmt = (v: number) => (v < 1 ? v.toFixed(1).replace(".", ",") : v.toFixed(0));
  const stops = [{ c: "var(--r0)", l: "seco" }, ...CUTS.map((c, i) => ({ c: `var(--r${i + 1})`, l: i === CUTS.length - 1 ? `${fmt(t)}+` : fmt(t * c) }))];
  return (
    <div className="relative flex items-center gap-3 border-t border-line px-4 py-3">
      <span className="eyebrow shrink-0">mm/h</span>
      <div className="flex flex-1 overflow-hidden rounded-md">
        {stops.map((s, i) => (
          <div key={i} className="flex-1">
            <div className="h-2" style={{ background: s.c }} />
            <p className="font-data mt-1 text-[10px] text-dim">{s.l}</p>
          </div>
        ))}
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
        <svg width="14" height="14" aria-hidden>
          <rect width="14" height="14" rx="3" fill="var(--r0)" />
          <path d="M0 14L14 0M-4 10L10-4M4 18L18 4" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        Asegurada
      </span>
    </div>
  );
}
