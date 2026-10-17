"use client";

import { ZONES } from "./zones";
import { useDashboard, useProductConfig } from "./hooks";
import { useNow } from "./useNow";

export type ZoneView = {
  id: number;
  name: string;
  area: string;
  rainX10: number;
  readingAt: number;
  maxRainX10: number;
  forecastProb: number;
  lastTriggerAt: number;
  storming: boolean;
  quote: bigint | undefined;
  status: number;
  exposure: bigint;
  paidOut: bigint;
};

/** Une el estado on-chain de hoy de cada zona con sus metadatos. */
export function useZoneViews() {
  const { data: dash, isLoading } = useDashboard();
  const { data: config } = useProductConfig();
  const now = useNow();
  const threshold = config?.rainThresholdX10 ?? 150;

  const views: ZoneView[] = ZONES.map((z) => {
    const day = dash?.[0][z.id];
    const reading = dash?.[1][z.id];
    const readingAt = Number(reading?.timestamp ?? 0);
    const rainX10 = reading?.rainX10 ?? 0;
    return {
      ...z,
      rainX10,
      readingAt,
      maxRainX10: day?.maxRainX10 ?? 0,
      forecastProb: day?.forecastProb ?? 0,
      lastTriggerAt: Number(day?.lastTriggerAt ?? 0),
      storming: rainX10 >= threshold && now - readingAt < 3600,
      quote: dash?.[2][z.id],
      status: dash?.[3][z.id] ?? 0,
      exposure: day?.exposure ?? 0n,
      paidOut: day?.paidOut ?? 0n,
    };
  });

  return { views, config, threshold, isLoading, now };
}
