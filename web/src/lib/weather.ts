import { ZONES } from "./zones";

/** Lluvia (mm/h) que el contrato considera tormenta. Debe coincidir con rainThresholdX10 / 10. */
const STORM_MM = 15;

export type WeatherReading = {
  zoneId: number;
  name: string;
  /** Lluvia de la última hora completa, en mm (≈ mm/h). */
  rainMm: number;
  /** Riesgo de tormenta (0-100) entre ahora y las 8 p. m. */
  forecastProb: number;
  time: string;
};

type OpenMeteo = {
  current: { time: string };
  hourly: { time: string[]; precipitation: number[]; precipitation_probability: (number | null)[] };
};

/** Consulta Open-Meteo para todas las zonas en una sola llamada. */
export async function fetchValleyWeather(): Promise<WeatherReading[]> {
  const params = new URLSearchParams({
    latitude: ZONES.map((z) => z.lat).join(","),
    longitude: ZONES.map((z) => z.lon).join(","),
    current: "precipitation",
    hourly: "precipitation,precipitation_probability",
    forecast_days: "1",
    timezone: "America/Bogota",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const body = (await res.json()) as OpenMeteo | OpenMeteo[];
  const list = Array.isArray(body) ? body : [body];

  return list.map((loc, i) => {
    const hourKey = loc.current.time.slice(0, 13) + ":00";
    const idx = Math.max(0, loc.hourly.time.indexOf(hourKey));
    // El valor de cada hora es la lluvia acumulada de la hora anterior.
    const rainMm = loc.hourly.precipitation[idx] ?? 0;
    // Riesgo de tormenta: en Medellín casi siempre hay alta probabilidad de *alguna* lluvia, así que se usa
    // la lluvia máxima pronosticada hasta las 8 p. m. frente al umbral, ponderada por su probabilidad.
    const end = loc.hourly.time.findIndex((t) => t.endsWith("T20:00")) + 1 || undefined;
    const risks = loc.hourly.precipitation.slice(idx, end).map((mm, j) => {
      const prob = (loc.hourly.precipitation_probability[idx + j] ?? 0) / 100;
      return Math.min(1, mm / STORM_MM) * prob * 100;
    });
    const forecastProb = Math.round(Math.max(0, ...risks));
    return { zoneId: ZONES[i].id, name: ZONES[i].name, rainMm, forecastProb, time: loc.current.time };
  });
}

/** mm/h → décimas de mm/h, como las espera el contrato. */
export const toX10 = (mm: number) => Math.max(0, Math.round(mm * 10));
