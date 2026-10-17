import { ZONES } from "./zones";
import type { Activity } from "./stats";

/**
 * Historial simulado para la demo: 14 días de coberturas y lluvia en las 25 zonas.
 * Es determinista (misma semilla → mismos datos) para que la presentación no cambie entre recargas.
 * No toca la cadena ni gasta MON.
 */

const TZ_OFFSET = 5 * 3600;
const PREMIUM = 250_000n;
const SURGE = 375_000n;
const PAYOUT = 3_500_000n;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Qué tan concurrida es cada zona por repartidores (más en el centro y los corredores de domicilios).
const DEMAND: Record<string, number> = {
  "La Candelaria": 1.6, "Laureles-Estadio": 1.5, "El Poblado": 1.5, Belén: 1.3, Itagüí: 1.3, Envigado: 1.25, Bello: 1.2,
  "La América": 1.0, Aranjuez: 1.0, Castilla: 0.95, Robledo: 0.9, Guayabal: 0.9, Sabaneta: 0.9, Manrique: 0.85,
  "Buenos Aires": 0.8, "San Javier": 0.75, "Villa Hermosa": 0.7, "Doce de Octubre": 0.7, Popular: 0.6, "Santa Cruz": 0.6,
  "La Estrella": 0.55, Copacabana: 0.5, Caldas: 0.4, Girardota: 0.35, Barbosa: 0.25,
};

// Las laderas y el sur del valle reciben más aguaceros por la tarde.
const WETNESS: Record<string, number> = {
  "Villa Hermosa": 1.3, "Buenos Aires": 1.25, Popular: 1.2, "Santa Cruz": 1.15, Manrique: 1.2, "San Javier": 1.15, Robledo: 1.1,
  Envigado: 1.2, Sabaneta: 1.15, Caldas: 1.25, "La Estrella": 1.15, Itagüí: 1.05, "El Poblado": 1.1, Bello: 0.95, Copacabana: 0.9,
  Girardota: 0.85, Barbosa: 0.85,
};

const hex = (r: () => number) => Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");

export function simulateHistory(days: number[], threshold: number, nowSec: number) {
  const r = rng(20251017);
  const riders = Array.from({ length: 180 }, () => `0x${hex(r)}`);
  // Cada repartidor tiene una zona habitual (ponderada por demanda).
  const weights = ZONES.map((z) => DEMAND[z.name] ?? 0.6);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pickZone = () => {
    let x = r() * totalW;
    for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) <= 0) return i;
    return weights.length - 1;
  };
  const home = riders.map(() => pickZone());

  const maxRain = new Map<string, number>();
  const list: Activity[] = [];
  let id = 1_000_000;

  for (const day of days) {
    const midnight = day * 86400 + TZ_OFFSET;
    if (midnight > nowSec) continue;
    const dow = new Date(midnight * 1000).getUTCDay();
    // Clima del día: cerca de la mitad de los días hay aguacero fuerte en 1 a 4 zonas
    // (elegidas según qué tan lluviosas son); el resto del valle tiene lluvia ligera o nada.
    const stormy = r() < 0.45;
    const stormCount = stormy ? 1 + Math.floor(r() * 4) : 0;
    const wet = r() < 0.75; // ¿llovió algo ese día?
    // Riesgo pronosticado alto → más gente se asegura.
    const demandBoost = (stormy ? 1.15 : wet ? 0.95 : 0.8) * (dow === 0 ? 0.6 : dow === 6 ? 0.85 : 1);
    const stormHour = 13 + Math.floor(r() * 6); // los aguaceros llegan entre 1 y 7 p. m.

    const stormZones = new Set<number>();
    const wetW = ZONES.map((z) => WETNESS[z.name] ?? 1);
    while (stormZones.size < stormCount) {
      let x = r() * wetW.reduce((p, q) => p + q, 0);
      let i = 0;
      while ((x -= wetW[i]) > 0) i++;
      stormZones.add(i);
    }

    const storm = new Map<number, number>(); // zona → instante del aguacero
    for (const z of ZONES) {
      const at = midnight + (stormHour + r() * 1.5) * 3600;
      const light = wet ? Math.max(0, (WETNESS[z.name] ?? 1) * r() * (stormy ? 12 : 8) - 1.5) : 0;
      const peak = stormZones.has(z.id) ? threshold / 10 + 0.5 + r() * 17 : Math.min(light, threshold / 10 - 0.6);
      if (at > nowSec) continue; // hoy: la lluvia de la tarde aún no ha llegado
      const x10 = Math.round(peak * 10);
      maxRain.set(`${z.id}-${day}`, x10);
      if (x10 >= threshold) storm.set(z.id, at);
    }

    riders.forEach((holder, k) => {
      if (r() > 0.42 * demandBoost) return;
      // A veces trabajan en otra zona ese día.
      const zoneId = r() < 0.82 ? home[k] : pickZone();
      const purchasedAt = Math.round(midnight + (6 + Math.pow(r(), 1.6) * 3) * 3600); // ventana 6–9 a. m.
      if (purchasedAt > nowSec) return;
      const surge = stormy && r() < 0.5; // días de riesgo alto: prima con recargo
      const stormAt = storm.get(zoneId);
      list.push({
        id: BigInt(id++),
        holder,
        zoneId,
        day,
        purchasedAt,
        premium: surge ? SURGE : PREMIUM,
        payout: PAYOUT,
        paid: stormAt !== undefined && stormAt >= purchasedAt + 3600,
        simulated: true,
      });
    });
  }

  return { list, maxRain };
}
