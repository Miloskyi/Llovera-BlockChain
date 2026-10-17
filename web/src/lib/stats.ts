"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { contractsConfigured } from "./config";
import { llovera, useProductConfig } from "./hooks";
import { ZONES } from "./zones";
import { simulateHistory } from "./demoStats";

/** Días de historial que se leen de la cadena (lluvia máxima por zona y día). */
export const HISTORY_DAYS = 14;
/** Coberturas más recientes que se leen (suficiente para un testnet; en producción iría un indexador). */
const MAX_POLICIES = 600;
const TZ_OFFSET = 5 * 3600;

const slow = { refetchInterval: 15_000, staleTime: 10_000 } as const;

export type ZoneStats = {
  id: number;
  name: string;
  area: string;
  policies: number;
  riders: number;
  premiums: bigint;
  paid: number;
  payouts: bigint;
  stormDays: number;
  maxRainX10: number;
  daily: { day: number; policies: number; paid: number; maxRainX10: number }[];
};

export type DayStats = { day: number; policies: number; paid: number; premiums: bigint; payouts: bigint; storms: number };

export type Activity = { id: bigint; holder: string; zoneId: number; day: number; purchasedAt: number; premium: bigint; payout: bigint; paid: boolean; simulated?: boolean };

/** Fecha (medianoche en Colombia) de un índice de día del contrato. */
export const dayDate = (day: number) => new Date((day * 86400 + TZ_OFFSET) * 1000);

/** `demo`: suma un historial simulado a los datos reales (útil para presentar sin gastar MON). */
export function useStats(demo = false) {
  const { data: config } = useProductConfig();
  // Sin cadena (p. ej. antes del despliegue) el día se calcula con el reloj, para que la demo funcione igual.
  const today = config ? Number(config.currentDay) : demo ? Math.floor((Date.now() / 1000 - TZ_OFFSET) / 86400) : undefined;
  const threshold = config?.rainThresholdX10 ?? 150;

  const count = useReadContract({ ...llovera, functionName: "policyCount", query: { ...slow, enabled: contractsConfigured } });
  const total = Number(count.data ?? 0n);
  const from = Math.max(0, total - MAX_POLICIES);

  const policies = useReadContracts({
    contracts: Array.from({ length: total - from }, (_, i) => ({ ...llovera, functionName: "getPolicy", args: [BigInt(from + i)] }) as const),
    query: { ...slow, enabled: total > 0 },
  });

  const days = today === undefined ? [] : Array.from({ length: HISTORY_DAYS }, (_, i) => today - HISTORY_DAYS + 1 + i);
  const zoneDays = useReadContracts({
    contracts: days.flatMap((d) => ZONES.map((z) => ({ ...llovera, functionName: "zoneDays", args: [BigInt(z.id), BigInt(d)] }) as const)),
    query: { ...slow, enabled: days.length > 0 },
  });

  const loading = !demo && (count.isLoading || (total > 0 && policies.isLoading) || !config);

  const stats = useMemo(() => {
    const real: Activity[] = (policies.data ?? []).flatMap((r, i) =>
      r.status === "success"
        ? [
            {
              id: BigInt(from + i),
              holder: r.result.holder,
              zoneId: Number(r.result.zoneId),
              purchasedAt: Number(r.result.purchasedAt),
              premium: r.result.premium,
              payout: r.result.payout,
              paid: r.result.paid,
              day: Number(r.result.day),
            },
          ]
        : [],
    );

    const sim = demo ? simulateHistory(days, threshold, Math.floor(Date.now() / 1000)) : null;
    const list = sim ? [...sim.list, ...real] : real;

    // Lluvia máxima por zona y día (desde la cadena).
    const maxRain = new Map<string, number>();
    (zoneDays.data ?? []).forEach((r, i) => {
      if (r.status !== "success") return;
      const d = days[Math.floor(i / ZONES.length)];
      const z = ZONES[i % ZONES.length].id;
      maxRain.set(`${z}-${d}`, Number((r.result as readonly unknown[])[4]));
    });
    if (sim) for (const [k, v] of sim.maxRain) maxRain.set(k, Math.max(v, maxRain.get(k) ?? 0));

    const zones: ZoneStats[] = ZONES.map((z) => {
      const mine = list.filter((p) => p.zoneId === z.id);
      const paidList = mine.filter((p) => p.paid);
      const daily = days.map((d) => {
        const ofDay = mine.filter((p) => p.day === d);
        return { day: d, policies: ofDay.length, paid: ofDay.filter((p) => p.paid).length, maxRainX10: maxRain.get(`${z.id}-${d}`) ?? 0 };
      });
      return {
        id: z.id,
        name: z.name,
        area: z.area,
        policies: mine.length,
        riders: new Set(mine.map((p) => p.holder.toLowerCase())).size,
        premiums: mine.reduce((a, p) => a + p.premium, 0n),
        paid: paidList.length,
        payouts: paidList.reduce((a, p) => a + p.payout, 0n),
        stormDays: daily.filter((d) => d.maxRainX10 >= threshold).length,
        maxRainX10: Math.max(0, ...daily.map((d) => d.maxRainX10)),
        daily,
      };
    });

    const byDay: DayStats[] = days.map((d) => {
      const ofDay = list.filter((p) => p.day === d);
      const paid = ofDay.filter((p) => p.paid);
      return {
        day: d,
        policies: ofDay.length,
        paid: paid.length,
        premiums: ofDay.reduce((a, p) => a + p.premium, 0n),
        payouts: paid.reduce((a, p) => a + p.payout, 0n),
        storms: zones.filter((z) => (maxRain.get(`${z.id}-${d}`) ?? 0) >= threshold).length,
      };
    });

    // Hora local (Colombia) en que se compran las coberturas.
    const hours = Array.from({ length: 24 }, () => 0);
    for (const p of list) hours[Math.floor((((p.purchasedAt - TZ_OFFSET) % 86400) + 86400) % 86400 / 3600)]++;

    const paidAll = list.filter((p) => p.paid);
    const premiums = list.reduce((a, p) => a + p.premium, 0n);
    const payouts = paidAll.reduce((a, p) => a + p.payout, 0n);
    return {
      zones,
      byDay,
      hours,
      recent: [...list].sort((a, b) => b.purchasedAt - a.purchasedAt).slice(0, 8),
      totals: {
        policies: list.length,
        riders: new Set(list.map((p) => p.holder.toLowerCase())).size,
        paid: paidAll.length,
        premiums,
        payouts,
        stormDays: byDay.reduce((a, d) => a + d.storms, 0),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies.data, zoneDays.data, threshold, total, from, today, demo]);

  return { ...stats, loading, threshold, today };
}
