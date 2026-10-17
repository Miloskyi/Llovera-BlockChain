"use client";

import { useState } from "react";
import { ValleyMap, rainColor, type MapFocus } from "./ValleyMap";
import { useZoneViews } from "@/lib/useZoneViews";

export function LiveHeroMap() {
  const { views, threshold } = useZoneViews();
  const [focus, setFocus] = useState<MapFocus>("valle");
  return (
    <ValleyMap
      zones={views.map((v) => ({ rainX10: v.rainX10, storming: v.storming, insured: false }))}
      threshold={threshold}
      focus={focus}
      onFocusChange={setFocus}
    />
  );
}

/** Resumen en vivo: cuántas zonas tienen lluvia y dónde llueve más. */
export function LiveStats() {
  const { views, isLoading } = useZoneViews();
  const raining = views.filter((v) => v.rainX10 >= 5);
  const top = [...views].sort((a, b) => b.rainX10 - a.rainX10)[0];
  const storms = views.filter((v) => v.storming).length;
  const cell = "panel p-5";
  if (isLoading) return <div className="skeleton h-28 w-full" />;
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className={cell}>
        <p className="eyebrow">Con lluvia</p>
        <p className="font-display mt-2 text-3xl font-extrabold text-cyan">
          {raining.length}
          <span className="text-base text-muted">/{views.length}</span>
        </p>
      </div>
      <div className={cell}>
        <p className="eyebrow">Más lluvia</p>
        <p className="font-display mt-2 truncate text-xl font-extrabold">{top && top.rainX10 > 0 ? top.name : "—"}</p>
        <p className="font-data text-xs text-muted">{top ? (top.rainX10 / 10).toFixed(1) : "0.0"} mm/h</p>
      </div>
      <div className={cell}>
        <p className="eyebrow">Tormentas</p>
        <p className={`font-display mt-2 text-3xl font-extrabold ${storms ? "text-bad" : ""}`}>{storms}</p>
      </div>
    </div>
  );
}

/** Cinta con la lluvia actual de cada zona, como un boletín en vivo. */
export function LiveTicker() {
  const { views, threshold } = useZoneViews();
  const items = [...views, ...views];
  return (
    <div className="relative overflow-hidden border-y border-line bg-bg-2/60 py-3" aria-label="Lluvia actual por zona">
      <div className="ticker flex w-max gap-8 whitespace-nowrap">
        {items.map((v, i) => (
          <span key={i} className="font-data flex items-center gap-2 text-sm" aria-hidden={i >= views.length}>
            <span className="h-2 w-2 rounded-full" style={{ background: v.rainX10 > 0 ? rainColor(v.rainX10, threshold) : "var(--dim)" }} />
            <span className="text-muted">{v.name}</span>
            <span>{(v.rainX10 / 10).toFixed(1)} mm/h</span>
          </span>
        ))}
      </div>
    </div>
  );
}
