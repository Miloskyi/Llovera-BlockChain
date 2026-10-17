"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotConfigured } from "@/components/NotConfigured";
import { ValleyMap, type MapFocus } from "@/components/ValleyMap";
import { Chip } from "@/components/bits";
import { Money } from "@/components/Money";
import { CountUp, Reveal } from "@/components/landing/Reveal";
import { HISTORY_DAYS, dayDate, useStats, type ZoneStats } from "@/lib/stats";
import { mm, shortAddr } from "@/lib/format";
import { ZONES } from "@/lib/zones";
import { useNow } from "@/lib/useNow";

type Metric = "policies" | "riders" | "paid" | "rain";

const METRICS: { id: Metric; label: string; color: string; unit: (z: ZoneStats) => string }[] = [
  { id: "policies", label: "Coberturas", color: "var(--accent)", unit: (z) => `${z.policies} coberturas` },
  { id: "riders", label: "Repartidores", color: "var(--cyan)", unit: (z) => `${z.riders} repartidores` },
  { id: "paid", label: "Pagos", color: "var(--ok)", unit: (z) => `${z.paid} pagos` },
  { id: "rain", label: "Lluvia máx.", color: "var(--r5)", unit: (z) => `máx. ${mm(z.maxRainX10)} mm/h` },
];

/** Recuerda la elección de simulados / reales en este navegador. */
function useDemoToggle(): [boolean, (v: boolean) => void] {
  const [demo, setDemo] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("llovera.statsDemo") === "0") setDemo(false);
    } catch {}
  }, []);
  const set = (v: boolean) => {
    setDemo(v);
    try {
      localStorage.setItem("llovera.statsDemo", v ? "1" : "0");
    } catch {}
  };
  return [demo, set];
}

const valueOf = (z: ZoneStats, m: Metric) => (m === "policies" ? z.policies : m === "riders" ? z.riders : m === "paid" ? z.paid : z.maxRainX10);

const shortDay = (d: number) => dayDate(d).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

function ago(seconds: number) {
  if (seconds < 60) return "hace un momento";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}

export default function Estadisticas() {
  const [demo, setDemo] = useDemoToggle();
  const s = useStats(demo);
  const now = useNow();
  const [metric, setMetric] = useState<Metric>("policies");
  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<MapFocus>("valle");

  const m = METRICS.find((x) => x.id === metric)!;
  const max = Math.max(1, ...s.zones.map((z) => valueOf(z, metric)));
  const ranking = [...s.zones].sort((a, b) => valueOf(b, metric) - valueOf(a, metric) || a.name.localeCompare(b.name));
  const zone = selected !== null ? s.zones[selected] : null;
  const payRate = s.totals.policies ? Math.round((s.totals.paid / s.totals.policies) * 100) : 0;
  const empty = !s.loading && s.totals.policies === 0;

  const select = (id: number) => {
    setSelected(id);
    setFocus({ zone: id });
  };

  return (
    <div>
      <NotConfigured />
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="live-dot" /> {demo ? "Demo · simulados + Monad" : "Datos leídos de Monad"}
          </p>
          <h1 className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">Estadísticas</h1>
          <p className="mt-2 max-w-2xl text-muted">Cuánta gente se asegura en cada zona, cuánto se ha pagado y dónde llueve más. Todo sale del contrato: nadie puede maquillar estos números.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="off">Últimos {HISTORY_DAYS} días</Chip>
          <div className="flex rounded-xl border border-line bg-bg/60 p-1" role="radiogroup" aria-label="Origen de los datos">
            {[
              [true, "Simulados"],
              [false, "Solo reales"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                role="radio"
                aria-checked={demo === v}
                onClick={() => setDemo(v as boolean)}
                className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${demo === v ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>
      </div>

      {demo && (
        <p className="rise mt-4 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <span aria-hidden>🧪</span>
          <span>
            <span className="font-semibold text-accent">Datos simulados para la demo.</span> Es un historial ficticio de {HISTORY_DAYS} días; las coberturas reales que compres en Monad se suman encima y aparecen marcadas como <span className="font-semibold">En cadena</span>.
          </span>
        </p>
      )}

      {/* Totales */}
      <div className="rise mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <Kpi label="Coberturas vendidas" loading={s.loading} icon="🛡️">
          <CountUp to={s.totals.policies} />
        </Kpi>
        <Kpi label="Repartidores" loading={s.loading} icon="🛵">
          <CountUp to={s.totals.riders} />
        </Kpi>
        <Kpi label="Pagado por lluvia" loading={s.loading} icon="💸" accent>
          <Money value={s.totals.payouts} />
        </Kpi>
        <Kpi label="Coberturas que cobraron" loading={s.loading} icon="⛈️" sub={`${s.totals.paid} de ${s.totals.policies}`}>
          <CountUp to={payRate} suffix=" %" />
        </Kpi>
      </div>

      {empty && (
        <div className="panel mt-6 p-6 text-center">
          <p className="text-4xl" aria-hidden>
            🌤️
          </p>
          <p className="font-display mt-2 text-2xl font-extrabold">Todavía no hay coberturas</p>
          <p className="mx-auto mt-1 max-w-md text-muted">Cuando alguien asegure su zona, aquí vas a ver el historial y el ranking de zonas.</p>
          <Link href="/asegurar" className="btn btn-accent btn-xl mt-4">
            Asegurar mi zona →
          </Link>
        </div>
      )}

      {/* Mapa de calor + ranking */}
      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Dato del mapa">
            {METRICS.map((x) => (
              <button key={x.id} role="tab" aria-selected={metric === x.id} className={`btn btn-sm ${metric === x.id ? "btn-accent" : "btn-ghost"}`} onClick={() => setMetric(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <ValleyMap
            zones={s.zones.map(() => ({ rainX10: 0, storming: false, insured: false }))}
            threshold={s.threshold}
            selected={selected}
            onSelect={select}
            focus={focus}
            onFocusChange={setFocus}
            colorOf={(i) => {
              const v = s.zones[i] ? valueOf(s.zones[i], metric) : 0;
              return v ? `color-mix(in oklab, ${m.color} ${Math.round(20 + (v / max) * 80)}%, var(--bg-2))` : "var(--r0)";
            }}
            hoverLabel={(i) => (s.zones[i] ? m.unit(s.zones[i]) : "")}
            legend={<HeatLegend color={m.color} max={metric === "rain" ? `${mm(max)} mm/h` : String(max)} />}
          />
        </div>

        <div className="space-y-4">
          {zone ? <ZoneDetail zone={zone} threshold={s.threshold} onClose={() => { setSelected(null); setFocus("valle"); }} /> : null}
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="eyebrow">Ranking · {m.label.toLowerCase()}</p>
              <p className="text-xs text-dim">Toca una zona</p>
            </div>
            <ol className="max-h-[28rem] space-y-1 overflow-y-auto">
              {ranking.map((z, i) => {
                const v = valueOf(z, metric);
                return (
                  <li key={z.id}>
                    <button
                      onClick={() => select(z.id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition hover:bg-white/[0.04] ${selected === z.id ? "bg-white/[0.06]" : ""}`}
                    >
                      <span className="font-data w-6 shrink-0 text-right text-sm text-dim">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-base font-semibold">{z.name}</span>
                          <span className="font-data shrink-0 text-sm">{metric === "rain" ? mm(v) : v}</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/5">
                          <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${(v / max) * 100}%`, background: m.color }} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Historial diario */}
      <Reveal as="section" className="panel mt-8 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Historial</p>
            <h2 className="font-display text-2xl font-extrabold">Día a día en todo el valle</h2>
          </div>
          <div className="flex gap-3 text-xs text-muted">
            <Legend color="var(--accent)" label="Coberturas" />
            <Legend color="var(--ok)" label="Pagadas" />
            <Legend color="var(--r5)" label="Zonas con tormenta" />
          </div>
        </div>
        <DayBars days={s.byDay} />
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* Hora de compra */}
        <Reveal as="section" className="panel p-5">
          <p className="eyebrow">Hábitos</p>
          <h2 className="font-display text-2xl font-extrabold">¿A qué hora se aseguran?</h2>
          <HourBars hours={s.hours} />
        </Reveal>

        {/* Actividad reciente */}
        <Reveal as="section" className="panel p-5" delay={100}>
          <p className="eyebrow">En vivo</p>
          <h2 className="font-display text-2xl font-extrabold">Últimas coberturas</h2>
          {s.recent.length === 0 ? (
            <p className="mt-4 text-muted">{s.loading ? "Cargando…" : "Aún no hay movimientos."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {s.recent.map((p) => (
                <li key={p.id.toString()} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{ZONES[p.zoneId]?.name}</p>
                    <p className="font-data text-xs text-muted">
                      {shortAddr(p.holder)} · {ago(Math.max(0, now - p.purchasedAt))}
                    </p>
                  </div>
                  {!p.simulated && demo && <Chip tone="accent">En cadena</Chip>}
                  {p.paid ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <Money value={p.payout} className="font-data text-sm font-semibold text-ok" />
                      <Chip tone="ok">Cobró</Chip>
                    </span>
                  ) : (
                    <Chip tone="off">Asegurado</Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </div>
  );
}

function Kpi({ label, icon, loading, accent, sub, children }: { label: string; icon: string; loading: boolean; accent?: boolean; sub?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        <span aria-hidden>{icon}</span>
        <span className="min-w-0 leading-tight">{label}</span>
      </p>
      {loading ? (
        <p className="skeleton mt-2 h-9 w-20" />
      ) : (
        <p className={`font-display mt-1 text-3xl font-extrabold sm:text-4xl ${accent ? "text-accent" : ""}`}>{children}</p>
      )}
      {sub && !loading && <p className="font-data mt-0.5 text-xs text-dim">{sub}</p>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function HeatLegend({ color, max }: { color: string; max: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-3">
      <span className="font-data text-[11px] text-dim">0</span>
      <div className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, var(--r0), color-mix(in oklab, ${color} 20%, var(--bg-2)), ${color})` }} />
      <span className="font-data text-[11px] text-dim">{max}</span>
    </div>
  );
}

function DayBars({ days }: { days: { day: number; policies: number; paid: number; storms: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.policies));
  // En el celular solo caben los últimos 7 días.
  const hide = (i: number) => (i < days.length - 7 ? "hidden sm:flex" : "flex");
  return (
    <div className="mt-5">
      <div className="flex items-end gap-1.5" style={{ height: 200 }}>
        {days.map((d, i) => (
          <div key={d.day} className={`group relative h-full flex-1 flex-col items-center justify-end ${hide(i)}`}>
            <span className="font-data mb-1 text-[11px] text-muted opacity-0 transition group-hover:opacity-100">{d.policies}</span>
            <div className="relative w-full overflow-hidden rounded-t-md bg-accent/80 transition-all duration-700" style={{ height: `${(d.policies / max) * 150}px`, transitionDelay: `${i * 30}ms` }}>
              <div className="absolute inset-x-0 bottom-0 bg-ok" style={{ height: d.policies ? `${(d.paid / d.policies) * 100}%` : 0 }} />
            </div>
            <div className="mt-1 flex h-3 items-center gap-0.5" title={`${d.storms} zonas con tormenta`}>
              {Array.from({ length: Math.min(d.storms, 5) }).map((_, k) => (
                <span key={k} className="h-1.5 w-1.5 rounded-full bg-[var(--r5)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t border-line pt-1">
        {days.map((d, i) => (
          <span key={d.day} className={`font-data flex-1 justify-center text-center text-[10px] ${hide(i)} ${i === days.length - 1 ? "text-accent" : "text-dim"}`}>
            {i === days.length - 1 ? "hoy" : shortDay(d.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const fmt = (h: number) => `${h % 12 || 12} ${h < 12 ? "a. m." : "p. m."}`;
  return (
    <div className="mt-4">
      <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
        {hours.map((n, h) => (
          <div
            key={h}
            title={`${fmt(h)}: ${n}`}
            className="flex-1 rounded-t-sm transition-all duration-700"
            style={{ height: `${Math.max(3, (n / max) * 100)}%`, background: n && h === peak ? "var(--accent)" : n ? "var(--cyan)" : "var(--line)" }}
          />
        ))}
      </div>
      <div className="font-data mt-1 flex justify-between text-[10px] text-dim">
        <span>12 a. m.</span>
        <span>6 a. m.</span>
        <span>12 p. m.</span>
        <span>6 p. m.</span>
        <span>11 p. m.</span>
      </div>
      {hours.some(Boolean) && (
        <p className="mt-3 text-sm text-muted">
          La hora con más compras es <span className="font-semibold text-accent">{fmt(peak)}</span>.
        </p>
      )}
    </div>
  );
}

function ZoneDetail({ zone, threshold, onClose }: { zone: ZoneStats; threshold: number; onClose: () => void }) {
  const max = Math.max(1, ...zone.daily.map((d) => d.policies));
  const rainMax = Math.max(threshold, ...zone.daily.map((d) => d.maxRainX10));
  return (
    <section className="panel rise border-accent/40 p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{zone.area}</p>
          <h2 className="font-display text-3xl font-extrabold leading-none">{zone.name}</h2>
        </div>
        <button className="min-h-10 px-2 text-sm text-dim hover:text-ink" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Coberturas" value={zone.policies} />
        <Mini label="Repartidores" value={zone.riders} />
        <Mini label="Pagos" value={zone.paid} tone="var(--ok)" />
        <Mini label="Días de tormenta" value={zone.stormDays} tone="var(--r5)" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg/50 p-3 text-sm">
        <p>
          <span className="block text-xs text-dim">Primas recibidas</span>
          <Money value={zone.premiums} className="font-semibold" extraDecimals />
        </p>
        <p>
          <span className="block text-xs text-dim">Pagado a repartidores</span>
          <Money value={zone.payouts} className="font-semibold text-ok" />
        </p>
      </div>

      <p className="eyebrow mt-4">Últimos {zone.daily.length} días</p>
      <div className="mt-2 flex items-end gap-1" style={{ height: 90 }}>
        {zone.daily.map((d) => (
          <div key={d.day} className="relative flex h-full flex-1 flex-col justify-end" title={`${shortDay(d.day)} · ${d.policies} coberturas · ${mm(d.maxRainX10)} mm/h`}>
            {/* lluvia máxima del día como fondo */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-sm"
              style={{ height: `${(d.maxRainX10 / rainMax) * 100}%`, background: d.maxRainX10 >= threshold ? "color-mix(in oklab, var(--r5) 35%, transparent)" : "color-mix(in oklab, var(--cyan) 18%, transparent)" }}
            />
            <div className="relative mx-auto w-2/3 rounded-t-sm bg-accent" style={{ height: `${(d.policies / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-dim">Barras amarillas: coberturas · fondo: lluvia máxima del día (rojo = pasó {mm(threshold)} mm/h).</p>
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-extrabold" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
