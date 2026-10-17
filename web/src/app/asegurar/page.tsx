"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { formatEther, maxUint256 } from "viem";
import { ValleyMap, rainColor, type MapFocus } from "@/components/ValleyMap";
import { NotConfigured } from "@/components/NotConfigured";
import { ConnectButton } from "@/components/ConnectButton";
import { Chip, RainGauge, SalesChip } from "@/components/bits";
import { Money, RateLine, UsdcNote } from "@/components/Money";
import { llovera, useAllowance, useMyPolicies, usePolicyFee, useTx, useUsdcBalance, usdc } from "@/lib/hooks";
import { useZoneViews, type ZoneView } from "@/lib/useZoneViews";
import { DEMO_ROUTES, useLocation } from "@/lib/useLocation";
import { clock } from "@/lib/format";
import { LLOVERA_ADDRESS, chain } from "@/lib/config";
import { ZONES } from "@/lib/zones";
import type { TxStep } from "@/components/TxFlow";

const FAUCET = 100_000_000n;
const SEEN_KEY = "llovera.seenPaid";

export default function MiTurno() {
  const { address, isConnected, chainId } = useAccount();
  const ready = isConnected && chainId === chain.id;
  const { views, config, threshold, now } = useZoneViews();
  const { data: balance } = useUsdcBalance();
  const { data: allowance } = useAllowance();
  const { data: mine } = useMyPolicies();
  const { data: fee } = usePolicyFee();
  const { run, send, celebrate, pending } = useTx();
  const loc = useLocation();

  const [focus, setFocus] = useState<MapFocus>("medellin");
  const [selected, setSelected] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  const today = Number(config?.currentDay ?? 0n);
  const myZone = loc.zoneId;

  const myPolicies = useMemo(() => {
    if (!mine) return [];
    const [ids, list] = mine;
    return ids.map((id, i) => ({ id, ...list[i] })).reverse();
  }, [mine]);
  const todayByZone = new Map(myPolicies.filter((p) => p.day === today).map((p) => [p.zoneId, p]));

  // Cuando la ubicación cambia de zona, el mapa la sigue.
  const lastZone = useRef<number | null>(null);
  useEffect(() => {
    if (myZone !== null && myZone !== lastZone.current) {
      setSelected(myZone);
      if (loc.routeProgress === null) setFocus({ zone: myZone });
    }
    lastZone.current = myZone;
  }, [myZone, loc.routeProgress]);

  // Celebración cuando una cobertura pasa a pagada.
  const seenPaid = useRef<Set<bigint> | null>(null);
  useEffect(() => {
    if (!mine) return;
    const paidNow = new Set(myPolicies.filter((p) => p.paid).map((p) => p.id));
    if (!seenPaid.current) {
      // Al volver de otra página, celebrar también lo que se pagó mientras no estabas aquí.
      try {
        const saved = sessionStorage.getItem(SEEN_KEY);
        if (saved) seenPaid.current = new Set((JSON.parse(saved) as string[]).map(BigInt));
      } catch {}
    }
    if (seenPaid.current) {
      const fresh = myPolicies.find((p) => p.paid && !seenPaid.current!.has(p.id));
      if (fresh)
        celebrate({
          title: "¡Te cayó la plata!",
          body: (
            <>
              <Money value={fresh.payout} className="font-display block text-5xl font-extrabold text-accent" />
              <span className="mt-2 block">por el aguacero en {ZONES[fresh.zoneId]?.name}. Ya está en tu billetera, sin reclamos ni papeleo.</span>
            </>
          ),
        });
    }
    seenPaid.current = paidNow;
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...paidNow].map(String)));
    } catch {}
  }, [mine, myPolicies, celebrate]);

  async function buy(z: ZoneView) {
    if (!z.quote || fee === undefined) return;
    const steps: TxStep[] = [];
    if ((allowance ?? 0n) < z.quote)
      steps.push({ label: "Autorizar el uso de tu saldo", params: { ...usdc, functionName: "approve", args: [LLOVERA_ADDRESS, maxUint256] } });
    steps.push({ label: "Pagar la cobertura de hoy", params: { ...llovera, functionName: "buyPolicy", args: [BigInt(z.id)], value: fee } as unknown as TxStep["params"] }); // TxStep no tipa `value` para funciones payable
    await run({
      key: "buy",
      title: `Asegurar ${z.name}`,
      steps,
      success: {
        title: "¡Listo, estás protegido!",
        body: `${z.name} queda cubierta hoy. Tu cobertura se activa en ${Math.round(Number(config?.cooldown ?? 60) / 60) || 1} min.`,
      },
    });
  }

  const zone = myZone !== null ? views[myZone] : null;
  const policy = myZone !== null ? todayByZone.get(myZone) : undefined;
  const otherToday = [...todayByZone.values()].filter((p) => p.zoneId !== myZone);
  const canBuy = !!zone && !policy && ready && zone.status === 0;
  const needsFunds = canBuy && balance !== undefined && zone?.quote !== undefined && balance < zone.quote;

  const faucet = () =>
    send("faucet", "Recibir saldo de prueba", { ...usdc, functionName: "faucet" }, {
      title: "¡Recibiste saldo!",
      body: (
        <>
          +<Money value={FAUCET} className="font-semibold text-ink" /> para probar Lloverá.
        </>
      ),
    });

  return (
    <div>
      <NotConfigured />

      <div className="rise mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="live-dot" /> En vivo · {config ? `${clock(Number(config.localTimeOfDay))}` : <span className="skeleton">00:00</span>}
          </p>
          <h1 className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">Mi turno</h1>
        </div>
        {config && !config.enforceWindow && <Chip tone="accent">Demo · carencia {Number(config.cooldown)} s</Chip>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        {/* Panel del repartidor: primero en el celular, a la derecha en escritorio */}
        <aside className="rise order-1 space-y-4 lg:sticky lg:top-24 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <section className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">¿Dónde estás?</p>
              {loc.mode !== "off" && (
                <button className="min-h-10 px-2 text-sm text-dim hover:text-ink" onClick={() => { loc.off(); setPicking(false); }}>
                  Apagar
                </button>
              )}
            </div>
            <LocationBody loc={loc} views={views} picking={picking} setPicking={setPicking} />
          </section>

          <section className={`panel p-5 ${zone?.storming ? "border-bad/60" : ""}`}>
            <p className="eyebrow">Tu cobertura de hoy</p>
            {!zone ? (
              <p className="mt-3 text-base text-muted">Cuando sepamos dónde estás, aquí ves cuánto cuesta proteger tu turno.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[2rem] font-extrabold leading-none">{zone.name}</h2>
                    <p className="mt-1 text-sm text-muted">{ZONES[zone.id].kind}</p>
                  </div>
                  {zone.storming ? <Chip tone="bad">⛈ Tormenta</Chip> : <Chip tone="off">Riesgo {zone.forecastProb}%</Chip>}
                </div>
                <RainGauge rainX10={zone.rainX10} threshold={threshold} big />

                {policy ? (
                  <PolicyState
                    policy={policy}
                    now={now}
                    zone={zone}
                    claiming={pending === `claim-${policy.id}`}
                    onClaim={(id) =>
                      send(`claim-${id}`, "Cobrar tu pago", { ...llovera, functionName: "claim", args: [id] }, { title: "¡Cobrado!", celebrate: true })
                    }
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-bg/50 p-4">
                      <div>
                        <p className="eyebrow">Pagas hoy</p>
                        <Money value={zone.quote} className="font-display mt-1 block text-[1.7rem] font-extrabold" extraDecimals />
                        <UsdcNote value={zone.quote} />
                      </div>
                      <div>
                        <p className="eyebrow">Si llueve duro</p>
                        <Money value={config?.payoutAmount} className="font-display mt-1 block text-[1.7rem] font-extrabold text-accent" />
                        <UsdcNote value={config?.payoutAmount} />
                      </div>
                    </div>
                    {!!fee && <p className="text-sm text-muted">+ tarifa de {formatEther(fee)} MON que se descuenta de tu billetera al asegurarte.</p>}
                    <SalesChip status={zone.status} />
                    <div className="hidden lg:block">
                      <BuyButton zone={zone} ready={ready} canBuy={canBuy} needsFunds={needsFunds} busy={pending === "buy"} onBuy={buy} onFaucet={faucet} />
                    </div>
                    <p className="text-sm text-dim">El pago depende de la lluvia en {zone.name} durante el día, aunque después te muevas a otra zona.</p>
                  </>
                )}
              </div>
            )}
            {otherToday.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="eyebrow">{zone ? "También tienes cubierta hoy" : "Tus coberturas de hoy"}</p>
                <div className="mt-2 grid gap-2">
                  {otherToday.map((p) => {
                    const v = views[p.zoneId];
                    const missed = !p.paid && !!v && v.lastTriggerAt > 0 && v.lastTriggerAt < Number(p.activeFrom);
                    const [label, tone] = p.paid
                      ? ["Pagada", "ok"]
                      : Number(p.activeFrom) > now
                        ? ["En carencia", "warn"]
                        : missed
                          ? ["Llovió antes", "off"]
                          : ["Activa", "accent"];
                    return (
                      <button
                        key={p.id.toString()}
                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line-2 bg-white/[0.03] px-3 py-2 text-left transition hover:border-muted"
                        onClick={() => { setSelected(p.zoneId); setFocus({ zone: p.zoneId }); }}
                      >
                        <span className="min-w-0 flex-1 truncate text-base font-semibold">{ZONES[p.zoneId]?.name}</span>
                        {p.paid && <Money value={p.payout} className="font-data text-sm font-semibold text-ok" />}
                        <Chip tone={tone as "ok"}>{label}</Chip>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-dim">Cada cobertura paga por la lluvia de su propia zona, estés donde estés.</p>
              </div>
            )}
          </section>

          <section className="panel p-5">
            <p className="eyebrow">Mi billetera</p>
            {ready ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Money value={balance} className="font-display block text-3xl font-extrabold" />
                  <UsdcNote value={balance} />
                </div>
                <button className="btn btn-ghost" disabled={pending === "faucet"} onClick={faucet}>
                  {pending === "faucet" ? <span className="mini-spin" /> : "＋"} Saldo de prueba
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-base text-muted">Conecta MetaMask para asegurarte y recibir tus pagos.</p>
                <ConnectButton size="lg" />
              </div>
            )}
            <RateLine className="mt-3" />
          </section>
        </aside>

        <div className="rise order-2 lg:order-none lg:col-start-1 lg:row-start-1" style={{ animationDelay: "80ms" }}>
          <ValleyMap
            zones={views.map((v) => ({ rainX10: v.rainX10, storming: v.storming, insured: todayByZone.has(v.id) }))}
            threshold={threshold}
            selected={selected}
            onSelect={setSelected}
            focus={focus}
            onFocusChange={setFocus}
            you={loc.point}
            picking={picking}
            onPick={(p) => {
              loc.setSimPoint(p);
              setPicking(false);
            }}
          />
        </div>

        <div className="rise order-3 lg:order-none lg:col-start-1 lg:row-start-2" style={{ animationDelay: "120ms" }}>
          <ZoneRadarList
            views={views}
            threshold={threshold}
            insured={todayByZone}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setFocus({ zone: id });
            }}
          />
        </div>
      </div>

      {address && myPolicies.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-4 text-2xl font-bold">Mis coberturas</h2>
          <div className="panel divide-y divide-line">
            {myPolicies.map((p) => {
              const state = p.paid ? ["Pagada", "ok"] : p.day < today ? ["Sin lluvia", "off"] : Number(p.activeFrom) > now ? ["En carencia", "warn"] : (views[p.zoneId]?.lastTriggerAt ?? 0) > 0 && (views[p.zoneId]?.lastTriggerAt ?? 0) < Number(p.activeFrom) ? ["Llovió antes", "off"] : ["Activa", "accent"];
              return (
                <div key={p.id.toString()} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{ZONES[p.zoneId]?.name}</p>
                    <p className="font-data text-xs text-muted">{new Date(Number(p.purchasedAt) * 1000).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {p.paid ? (
                      <Money value={p.payout} className="font-data text-base font-semibold text-ok" />
                    ) : (
                      <span className="font-data text-sm text-muted">
                        −<Money value={p.premium} extraDecimals />
                      </span>
                    )}
                    <Chip tone={state[1] as "ok"}>{state[0]}</Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Botón fijo al alcance del pulgar (solo celular) */}
      {zone && !policy && <div className="h-24 lg:hidden" aria-hidden />}
      {zone && !policy && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <BuyButton zone={zone} ready={ready} canBuy={canBuy} needsFunds={needsFunds} busy={pending === "buy"} onBuy={buy} onFaucet={faucet} />
        </div>
      )}
    </div>
  );
}

function BuyButton({
  zone,
  ready,
  canBuy,
  needsFunds,
  busy,
  onBuy,
  onFaucet,
}: {
  zone: ZoneView;
  ready: boolean;
  canBuy: boolean;
  needsFunds: boolean;
  busy: boolean;
  onBuy: (z: ZoneView) => void;
  onFaucet: () => void;
}) {
  if (!ready) return <ConnectButton size="lg" />;
  if (needsFunds)
    return (
      <button className="btn btn-accent btn-xl w-full" onClick={onFaucet}>
        Pedir saldo de prueba para asegurarme
      </button>
    );
  return (
    <button className="btn btn-accent btn-xl w-full" disabled={!canBuy || busy} onClick={() => onBuy(zone)}>
      {busy ? (
        <>
          <span className="mini-spin" /> Asegurando…
        </>
      ) : canBuy ? (
        <>
          Asegurar {zone.name} · <Money value={zone.quote} extraDecimals />
        </>
      ) : (
        "No disponible ahora"
      )}
    </button>
  );
}

function LocationBody({
  loc,
  views,
  picking,
  setPicking,
}: {
  loc: ReturnType<typeof useLocation>;
  views: ZoneView[];
  picking: boolean;
  setPicking: (v: boolean) => void;
}) {
  if (loc.mode === "off") {
    return (
      <div className="mt-3 space-y-3">
        <p className="text-base text-muted">Usamos tu ubicación solo para saber en qué zona estás. No se guarda ni se envía a la blockchain.</p>
        <button className="btn btn-accent btn-xl w-full" onClick={loc.startGps}>
          <GpsIcon /> Usar mi ubicación
        </button>
        <button className="btn btn-ghost w-full" onClick={() => { loc.startSim(); setPicking(true); }}>
          Simular ubicación (demo)
        </button>
      </div>
    );
  }

  const zoneName = loc.zoneId !== null ? views[loc.zoneId]?.name : null;
  const place = zoneName ? (
    <p className="mt-3 text-base">
      Estás en <span className="font-display block text-3xl font-extrabold text-cyan">{zoneName}</span>
      {loc.accuracy && <span className="font-data text-xs text-dim">Precisión ±{Math.round(loc.accuracy)} m</span>}
    </p>
  ) : loc.point ? (
    <p className="mt-3 text-base text-warn">
      {loc.rural ? `Zona rural (${loc.rural}): todavía no tenemos cobertura aquí.` : "Estás fuera del Valle de Aburrá. Lloverá cubre las 25 zonas urbanas del valle."}
    </p>
  ) : null;

  if (loc.mode === "gps") {
    const msg = {
      idle: null,
      requesting: "Toca «Permitir» en el aviso del navegador…",
      ok: null,
      denied: "No nos diste permiso de ubicación. Actívalo en el candado de la barra de direcciones, o usa la simulación.",
      unavailable: "Este navegador no tiene GPS disponible.",
      error: "No encontramos tu ubicación. Sal a un lugar abierto o usa la simulación.",
    }[loc.gpsStatus];
    return (
      <div className="mt-2">
        <Chip tone={loc.gpsStatus === "ok" ? "ok" : loc.gpsStatus === "requesting" ? "warn" : loc.gpsStatus === "idle" ? "off" : "bad"}>
          {loc.gpsStatus === "requesting" && <span className="mini-spin" />}
          GPS {loc.gpsStatus === "ok" ? "activo" : loc.gpsStatus === "requesting" ? "buscando" : "sin señal"}
        </Chip>
        {msg && <p className="mt-3 text-base text-muted">{msg}</p>}
        {loc.gpsStatus === "requesting" && !loc.point && <p className="skeleton mt-3 h-9 w-48" />}
        {place}
        {(loc.gpsStatus === "denied" || loc.gpsStatus === "error" || loc.gpsStatus === "unavailable" || (loc.point && loc.zoneId === null)) && (
          <button className="btn btn-ghost mt-3 w-full" onClick={() => { loc.startSim(); setPicking(true); }}>
            Usar simulación
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <Chip tone="accent">Simulación de GPS · demo</Chip>
      {place ?? <p className="mt-3 text-base text-muted">Toca el mapa para ubicarte o reproduce un recorrido.</p>}
      {loc.routeProgress !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-cyan transition-all" style={{ width: `${loc.routeProgress * 100}%` }} />
        </div>
      )}
      <button className={`btn mt-3 w-full ${picking ? "btn-accent" : "btn-ghost"}`} onClick={() => setPicking(!picking)}>
        📍 {picking ? "Toca un punto del mapa…" : "Ubicarme en el mapa"}
      </button>

      <p className="eyebrow mt-4">Recorridos de demo</p>
      <div className="mt-2 grid gap-2">
        {DEMO_ROUTES.map((r) => (
          <button
            key={r.id}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line-2 bg-white/[0.03] px-3 py-2 text-left transition hover:border-muted"
            onClick={() => { setPicking(false); loc.playRoute(r.stops); }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-sm text-cyan" aria-hidden>▶</span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{r.name}</span>
          </button>
        ))}
      </div>

      <button className="btn btn-ghost mt-3 w-full" onClick={loc.startGps}>
        <GpsIcon /> Usar mi GPS real
      </button>
    </div>
  );
}

function PolicyState({
  policy,
  now,
  zone,
  claiming,
  onClaim,
}: {
  policy: { id: bigint; paid: boolean; activeFrom: bigint; purchasedAt: bigint; payout: bigint; premium: bigint };
  now: number;
  zone: ZoneView;
  claiming: boolean;
  onClaim: (id: bigint) => void;
}) {
  const activeFrom = Number(policy.activeFrom);
  const total = Math.max(1, activeFrom - Number(policy.purchasedAt));
  const left = activeFrom - now;
  const eligible = !policy.paid && zone.lastTriggerAt >= activeFrom;
  const missed = !policy.paid && zone.lastTriggerAt > 0 && zone.lastTriggerAt < activeFrom;

  if (policy.paid) {
    return (
      <div className="rounded-2xl border border-ok/40 bg-ok/10 p-4">
        <p className="eyebrow" style={{ color: "var(--ok)" }}>Pago recibido</p>
        <Money value={policy.payout} className="font-display mt-1 block text-4xl font-extrabold text-ok" />
        <p className="mt-1 text-base text-muted">Te pagamos solos cuando llegó el aguacero.</p>
      </div>
    );
  }
  if (left > 0) {
    const pct = 100 - (left / total) * 100;
    return (
      <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow" style={{ color: "var(--warn)" }}>Protegido · se activa en</p>
          <span className="font-data text-2xl font-semibold text-warn">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-warn transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {zone.storming
            ? "Ya está lloviendo duro, pero esa medición no cuenta: la lluvia que paga es la que llegue después de la cuenta."
            : "Esta espera evita que alguien compre cuando ya está cayendo el aguacero."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <p className="eyebrow" style={{ color: "var(--accent)" }}>✓ Estás protegido</p>
      <p className="mt-1 text-base">
        Si llueve duro en {zone.name}, te llegan <Money value={policy.payout} className="font-semibold text-accent" /> al instante.
      </p>
      {missed && !eligible && (
        <p className="mt-2 text-sm text-muted">
          El último aguacero en {zone.name} llegó antes de que tu cobertura se activara, así que ese no cuenta. Si vuelve a llover duro hoy, te pagamos al instante.
        </p>
      )}
      {eligible && (
        <button className="btn btn-accent btn-xl mt-3 w-full" disabled={claiming} onClick={() => onClaim(policy.id)}>
          {claiming && <span className="mini-spin" />} Cobrar ahora
        </button>
      )}
    </div>
  );
}

function ZoneRadarList({
  views,
  threshold,
  insured,
  selected,
  onSelect,
}: {
  views: ZoneView[];
  threshold: number;
  insured: Map<number, unknown>;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const sorted = [...views].sort((a, b) => b.rainX10 - a.rainX10 || a.name.localeCompare(b.name));
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="eyebrow">Lluvia por zona</p>
        <p className="font-data text-xs text-dim">mm/h</p>
      </div>
      <div className="grid max-h-96 gap-x-6 overflow-y-auto sm:grid-cols-2">
        {sorted.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[0.04] ${selected === v.id ? "bg-white/[0.06]" : ""}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: rainColor(v.rainX10, threshold) }} />
            <span className="min-w-0 flex-1 truncate text-base">
              {v.name}
              {insured.has(v.id) && <span className="ml-1.5 text-accent">●</span>}
            </span>
            <span className="font-data text-sm text-muted">{(v.rainX10 / 10).toFixed(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GpsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  );
}
