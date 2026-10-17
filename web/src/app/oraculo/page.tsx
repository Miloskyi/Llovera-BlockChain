"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { NotConfigured } from "@/components/NotConfigured";
import { ConnectButton } from "@/components/ConnectButton";
import { ValleyMap, rainColor, type MapFocus } from "@/components/ValleyMap";
import { Chip } from "@/components/bits";
import { llovera, useIsAdmin, useIsOracle, useTx, useZonePolicies } from "@/lib/hooks";
import { useZoneViews } from "@/lib/useZoneViews";
import { chain } from "@/lib/config";
import { mm } from "@/lib/format";
import { Money } from "@/components/Money";
import { toX10, type WeatherReading } from "@/lib/weather";
import { ZONES } from "@/lib/zones";

const ALL_IDS = ZONES.map((z) => BigInt(z.id));

export default function Oraculo() {
  const { isConnected, chainId } = useAccount();
  const ready = isConnected && chainId === chain.id;
  const { data: isOracle } = useIsOracle();
  const { data: isAdmin } = useIsAdmin();
  const { views, config, threshold, now } = useZoneViews();
  const { send, run, pending } = useTx();

  const [zone, setZone] = useState(21); // Itagüí
  const [focus, setFocus] = useState<MapFocus>("valle");
  const [intensity, setIntensity] = useState(25);
  const [real, setReal] = useState<WeatherReading[] | null>(null);
  const [loadingReal, setLoadingReal] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);

  const canReport = ready && !!isOracle;
  const today = config?.currentDay ?? 0n;
  const z = views[zone];
  const payout = config?.payoutAmount || 1n;
  const policiesInZone = z ? Number(z.exposure / payout) : 0;
  const paidInZone = z ? Number(z.paidOut / payout) : 0;
  const triggers = intensity * 10 >= threshold;
  const zonePolicies = useZonePolicies(zone, config?.currentDay);
  const waiting = zonePolicies.filter((p) => !p.paid && Number(p.activeFrom) > now);
  const waitLeft = waiting.length ? Math.max(...waiting.map((p) => Number(p.activeFrom))) - now : 0;
  const unpaidActive = zonePolicies.filter((p) => !p.paid && Number(p.activeFrom) <= now).length;

  async function loadReal() {
    setLoadingReal(true);
    setRealError(null);
    try {
      const res = await fetch("/api/oracle", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error consultando el clima");
      setReal(body.readings);
    } catch (e) {
      setRealError((e as Error).message);
    } finally {
      setLoadingReal(false);
    }
  }

  const report = (id: number, x10: number, label: string) =>
    send(`rain-${id}`, label, { ...llovera, functionName: "reportRain", args: [BigInt(id), BigInt(x10)] });

  const reportAll = (x10: number, label: string) =>
    send("rain-all", label, { ...llovera, functionName: "reportRainBatch", args: [ALL_IDS, ALL_IDS.map(() => BigInt(x10))] });

  async function publishReal() {
    if (!real) return;
    const ids = real.map((r) => BigInt(r.zoneId));
    await run({
      key: "publish",
      title: "Publicar clima real",
      steps: [
        { label: "Publicar riesgo de tormenta", params: { ...llovera, functionName: "setForecastBatch", args: [ids, real.map((r) => BigInt(r.forecastProb))] } },
        { label: "Publicar lluvia actual", params: { ...llovera, functionName: "reportRainBatch", args: [ids, real.map((r) => BigInt(toX10(r.rainMm)))] } },
      ],
      success: { title: "Clima real publicado", body: "Las 25 zonas quedaron actualizadas en Monad." },
    });
  }

  const setDemo = (demo: boolean) =>
    send(
      "schedule",
      demo ? "Modo demo activado" : "Modo producción activado",
      demo
        ? { ...llovera, functionName: "setSchedule", args: [false, 60, 6 * 3600, 9 * 3600, 86400] }
        : { ...llovera, functionName: "setSchedule", args: [true, 3600, 6 * 3600, 9 * 3600, 20 * 3600] },
    );

  return (
    <div>
      <NotConfigured />
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Sala de control</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">Oráculo de lluvia</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Publica en Monad la lluvia de cada zona. Si un reporte supera {mm(threshold)} mm/h, el contrato paga en la misma transacción a las coberturas activas.
          </p>
        </div>
        {ready && isOracle && <Chip tone="ok">Wallet con rol de oráculo</Chip>}
      </div>

      {!ready ? (
        <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="font-semibold">Conecta la wallet del oráculo.</p>
          <ConnectButton />
        </div>
      ) : !isOracle ? (
        <div className="panel mt-6 border-warn/50 p-5">
          <p className="font-semibold text-warn">Esta wallet no tiene el rol de oráculo.</p>
          <p className="text-sm text-muted">Solo la wallet que desplegó el contrato (o a la que se le dio ORACLE_ROLE) puede reportar lluvia.</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <ValleyMap
          zones={views.map((v) => ({ rainX10: v.rainX10, storming: v.storming, insured: v.exposure > 0n }))}
          threshold={threshold}
          selected={zone}
          onSelect={setZone}
          focus={focus}
          onFocusChange={setFocus}
          className="lg:sticky lg:top-24 lg:self-start"
        />

        <div className="space-y-4">
          <section className="panel relative overflow-hidden p-6" style={{ borderColor: "color-mix(in oklab, var(--bad) 45%, var(--line))" }}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: "rgba(255,61,110,.15)" }} />
            <p className="eyebrow" style={{ color: "var(--bad)" }}>Demo</p>
            <h2 className="font-display text-3xl font-extrabold">Simular tormenta</h2>

            <label className="mt-5 block text-sm font-semibold">
              Zona
              <select className="input mt-1.5" value={zone} onChange={(e) => setZone(Number(e.target.value))}>
                {(["Medellín", "Norte", "Sur"] as const).map((area) => (
                  <optgroup key={area} label={area}>
                    {ZONES.filter((zz) => zz.area === area).map((zz) => (
                      <option key={zz.id} value={zz.id}>
                        {zz.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Intensidad</span>
                <span className="font-data text-2xl font-semibold" style={{ color: rainColor(intensity * 10, threshold) }}>
                  {intensity} <span className="text-sm text-muted">mm/h</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={intensity}
                aria-label="Intensidad de la lluvia en mm/h"
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <p className={`mt-1 text-xs ${triggers ? "text-bad" : "text-muted"}`}>
                {triggers ? "Supera el umbral: activa pagos" : `No alcanza el umbral de ${mm(threshold)} mm/h`}
              </p>
            </div>

            <div className="font-data mt-4 grid grid-cols-3 gap-2 rounded-xl border border-line bg-bg/50 p-3 text-center text-xs">
              <div>
                <p className="text-lg text-ink">{policiesInZone}</p>
                <p className="text-dim">coberturas hoy</p>
              </div>
              <div>
                <p className="text-lg text-ok">{paidInZone}</p>
                <p className="text-dim">pagadas</p>
              </div>
              <div>
                <p className="text-lg text-ink">{mm(z?.rainX10)}</p>
                <p className="text-dim">mm/h ahora</p>
              </div>
            </div>

            {triggers && waiting.length > 0 && (
              <div className="mt-4 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm" role="status">
                <p className="font-semibold text-warn">
                  ⏳ {waiting.length === 1 ? "1 cobertura sigue" : `${waiting.length} coberturas siguen`} en carencia · {Math.floor(waitLeft / 60)}:
                  {String(waitLeft % 60).padStart(2, "0")}
                </p>
                <p className="mt-1 text-muted">
                  Si lanzas la tormenta ahora, el contrato no les paga: la lluvia llegó antes de que la cobertura se activara. Espera a que termine la cuenta.
                </p>
              </div>
            )}
            {triggers && waiting.length === 0 && unpaidActive > 0 && (
              <p className="mt-4 rounded-xl border border-ok/40 bg-ok/10 p-3 text-sm text-ok" role="status">
                ✓ {unpaidActive === 1 ? "1 cobertura activa recibe" : `${unpaidActive} coberturas activas reciben`} el pago con esta tormenta.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="btn btn-storm px-6 py-3 text-base"
                disabled={!canReport || pending === `rain-${zone}`}
                onClick={() => report(zone, intensity * 10, `Tormenta de ${intensity} mm/h en ${z?.name}`)}
              >
                {pending === `rain-${zone}` ? "Enviando…" : `⛈ Lanzar tormenta en ${z?.name}`}
              </button>
              <button className="btn btn-ghost" disabled={!canReport || pending === `rain-${zone}`} onClick={() => report(zone, 0, `${z?.name} despejada`)}>
                ☀ Despejar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              <button className="btn btn-ghost btn-sm" disabled={!canReport || pending === "rain-all"} onClick={() => reportAll(intensity * 10, "Tormenta en todo el valle")}>
                ⛈ Todo el valle
              </button>
              <button className="btn btn-ghost btn-sm" disabled={!canReport || pending === "rain-all"} onClick={() => reportAll(0, "Valle despejado")}>
                ☀ Despejar todo
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={!canReport || pending === `settle-${zone}`}
                onClick={() => send(`settle-${zone}`, "Pagos pendientes liquidados", { ...llovera, functionName: "settle", args: [BigInt(zone), today, 200n] })}
                title="Paga coberturas que no alcanzaron a pagarse en la transacción del oráculo"
              >
                Liquidar pendientes
              </button>
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Fuente</p>
                <h2 className="font-display text-xl font-bold">Datos reales · Open-Meteo</h2>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" disabled={loadingReal} onClick={loadReal}>
                  {loadingReal ? "Consultando…" : "Consultar"}
                </button>
                <button className="btn btn-accent btn-sm" disabled={!canReport || !real || pending === "publish"} onClick={publishReal}>
                  Publicar en Monad
                </button>
              </div>
            </div>
            {realError && <p className="mt-2 text-sm text-bad">{realError}</p>}
            {real && (
              <div className="mt-4 max-h-72 overflow-auto">
                <table className="font-data w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel text-dim">
                    <tr>
                      <th className="py-1.5 font-normal">Zona</th>
                      <th className="font-normal">Real</th>
                      <th className="font-normal">Riesgo</th>
                      <th className="font-normal">En cadena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {real.map((r) => (
                      <tr key={r.zoneId} className="border-t border-line">
                        <td className="py-1.5 font-sans text-sm">{r.name}</td>
                        <td>{r.rainMm.toFixed(1)}</td>
                        <td>{r.forecastProb}%</td>
                        <td className="text-muted">{mm(views[r.zoneId]?.rainX10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel p-6">
            <p className="eyebrow mb-3">Estado de hoy por zona</p>
            <div className="max-h-80 overflow-auto">
              <table className="font-data w-full text-left text-xs">
                <thead className="sticky top-0 bg-panel text-dim">
                  <tr>
                    <th className="py-1.5 font-normal">Zona</th>
                    <th className="font-normal">Lluvia</th>
                    <th className="font-normal">Máx.</th>
                    <th className="font-normal">Comprom.</th>
                    <th className="font-normal">Pagado</th>
                    <th className="font-normal">Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {views.map((v) => (
                    <tr key={v.id} className={`border-t border-line ${v.id === zone ? "bg-white/[0.04]" : ""}`}>
                      <td className="py-1.5 font-sans text-sm">{v.name}</td>
                      <td style={{ color: v.rainX10 > 0 ? rainColor(v.rainX10, threshold) : undefined }}>{mm(v.rainX10)}</td>
                      <td>{mm(v.maxRainX10)}</td>
                      <td><Money value={v.exposure} /></td>
                      <td><Money value={v.paidOut} /></td>
                      <td className="text-dim">{v.readingAt ? `${Math.max(0, Math.round((now - v.readingAt) / 60))} min` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {ready && isAdmin && config && (
            <section className="panel p-6">
              <p className="eyebrow">Administración</p>
              <p className="mt-2 text-sm text-muted">
                {config.enforceWindow
                  ? "Modo producción: compra de 6 a 9 a. m., carencia de 60 min, cobertura hasta las 8 p. m."
                  : `Modo demo: compra a cualquier hora, carencia de ${config.cooldown} s.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-ghost btn-sm" disabled={!config.enforceWindow || pending === "schedule"} onClick={() => setDemo(true)}>
                  Activar modo demo
                </button>
                <button className="btn btn-ghost btn-sm" disabled={config.enforceWindow || pending === "schedule"} onClick={() => setDemo(false)}>
                  Activar modo producción
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
