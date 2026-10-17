import { ZONE_GEO, type ZoneGeo } from "./geo";

// El índice es el zoneId del contrato. El orden debe coincidir con contracts/script/Deploy.s.sol.
export type ZoneMeta = ZoneGeo & { lat: number; lon: number };

export const ZONES: ZoneMeta[] = ZONE_GEO.map((z) => ({ ...z, lon: z.weather[0], lat: z.weather[1] }));
