import { NextResponse } from "next/server";
import { CURRENCIES, FALLBACK_RATES, type RatesPayload } from "@/lib/currencies";

// Las tasas cambian una vez al día; se cachean 6 horas en el servidor.
export const revalidate = 21600;

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate } });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { result: string; time_last_update_unix: number; rates: Record<string, number> };
    if (body.result !== "success") throw new Error("respuesta inválida");
    const rates = Object.fromEntries(CURRENCIES.map((c) => [c.code, body.rates[c.code] ?? FALLBACK_RATES[c.code]]));
    const payload: RatesPayload = { rates, updatedAt: body.time_last_update_unix * 1000, live: true };
    return NextResponse.json(payload);
  } catch {
    const payload: RatesPayload = { rates: FALLBACK_RATES, updatedAt: null, live: false };
    return NextResponse.json(payload);
  }
}
