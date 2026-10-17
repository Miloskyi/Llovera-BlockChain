import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { lloveraAbi } from "@/lib/abi";
import { LLOVERA_ADDRESS, chain, rpcUrl } from "@/lib/config";
import { fetchValleyWeather, toX10 } from "@/lib/weather";

export const dynamic = "force-dynamic";

/** Cambio mínimo de lluvia (décimas de mm/h) para volver a publicar una zona. */
const RAIN_DELTA_X10 = 5;
/** Cambio mínimo del riesgo de tormenta (puntos) para volver a publicarlo. */
const RISK_DELTA = 10;

/**
 * Oráculo de Lloverá.
 * - GET sin autorización: devuelve la lluvia real de cada zona (no escribe nada, no gasta gas).
 * - GET con `Authorization: Bearer $CRON_SECRET`: publica en el contrato, firmando con ORACLE_PRIVATE_KEY.
 *   Para ahorrar MON solo envía las zonas cuyo valor cambió respecto a lo que ya está en la cadena,
 *   y no envía ninguna transacción si nada cambió (en Monad se paga por el límite de gas de cada envío).
 */
export async function GET(request: Request) {
  let readings;
  try {
    readings = await fetchValleyWeather();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const secret = process.env.CRON_SECRET;
  const authorized = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) return NextResponse.json({ published: false, readings });

  const key = process.env.ORACLE_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return NextResponse.json({ error: "Falta ORACLE_PRIVATE_KEY" }, { status: 500 });

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  try {
    // Lo que ya está publicado hoy en la cadena.
    const [today, onchain] = await client.readContract({
      address: LLOVERA_ADDRESS,
      abi: lloveraAbi,
      functionName: "dashboard",
      args: ["0x0000000000000000000000000000000000000000"],
    });

    const rainChanged = readings.filter((r) => Math.abs(toX10(r.rainMm) - (onchain[r.zoneId]?.rainX10 ?? 0)) >= RAIN_DELTA_X10);
    const riskChanged = readings.filter((r) => Math.abs(r.forecastProb - (today[r.zoneId]?.forecastProb ?? 0)) >= RISK_DELTA);

    let forecastHash: `0x${string}` | null = null;
    let rainHash: `0x${string}` | null = null;

    if (riskChanged.length) {
      forecastHash = await wallet.writeContract({
        address: LLOVERA_ADDRESS,
        abi: lloveraAbi,
        functionName: "setForecastBatch",
        args: [riskChanged.map((r) => BigInt(r.zoneId)), riskChanged.map((r) => BigInt(r.forecastProb))],
      });
      await client.waitForTransactionReceipt({ hash: forecastHash });
    }
    if (rainChanged.length) {
      rainHash = await wallet.writeContract({
        address: LLOVERA_ADDRESS,
        abi: lloveraAbi,
        functionName: "reportRainBatch",
        args: [rainChanged.map((r) => BigInt(r.zoneId)), rainChanged.map((r) => BigInt(toX10(r.rainMm)))],
      });
      await client.waitForTransactionReceipt({ hash: rainHash });
    }

    return NextResponse.json({
      published: !!(forecastHash || rainHash),
      zonesWithRainUpdate: rainChanged.length,
      zonesWithRiskUpdate: riskChanged.length,
      forecastHash,
      rainHash,
      readings,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.split("\n")[0], readings }, { status: 500 });
  }
}
