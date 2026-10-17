"use client";

import { useProductConfig } from "@/lib/hooks";
import { clock, duration, mm } from "@/lib/format";
import { Money, RateLine, UsdcNote } from "./Money";

const DEFAULT_PREMIUM = 250_000n;
const DEFAULT_PAYOUT = 3_500_000n;

/** "Boleta" con la tarifa y las reglas, leída en vivo del contrato y mostrada en la moneda del usuario. */
export function LiveTerms() {
  const { data: c } = useProductConfig();

  const premium = c?.basePremium ?? DEFAULT_PREMIUM;
  const payout = c?.payoutAmount ?? DEFAULT_PAYOUT;
  const threshold = c ? mm(c.rainThresholdX10) : "15.0";
  const cooldown = c ? duration(c.cooldown) : "60 min";
  const window = c ? (c.enforceWindow ? `${clock(c.windowStart)} – ${clock(c.windowEnd)}` : "Libre (modo demo)") : "6:00 – 9:00 a. m.";
  const coverageEnd = c ? (c.coverageEnd >= 86400 ? "Medianoche" : clock(c.coverageEnd)) : "8:00 p. m.";
  const multiple = Math.round(Number(payout) / Number(premium));

  const rows: [string, React.ReactNode][] = [
    ["Lluvia que activa el pago", `≥ ${threshold} mm/h`],
    [`Con riesgo de tormenta ≥ ${c?.forecastSurgeProb ?? 50}%`, <Money key="s" value={(premium * 150n) / 100n} extraDecimals />],
    ["Espera antes de activarse", cooldown],
    ["Horario de compra", window],
    ["Cobertura hasta", coverageEnd],
    ["No se vende si", `riesgo ≥ ${c?.forecastCloseProb ?? 80}% o ya llueve`],
    ["Límite", "1 cobertura por zona al día"],
  ];

  return (
    <div className="panel relative overflow-hidden">
      <div className="grid grid-cols-2 border-b border-dashed border-line-2">
        <div className="p-5 sm:p-6">
          <p className="eyebrow">Pagas al día</p>
          <Money value={premium} extraDecimals className="font-display mt-2 block text-4xl font-extrabold sm:text-5xl" />
          <UsdcNote value={premium} />
        </div>
        <div className="border-l border-dashed border-line-2 p-5 sm:p-6">
          <p className="eyebrow">Si cae el aguacero</p>
          <Money value={payout} className="font-display mt-2 block text-4xl font-extrabold text-accent sm:text-5xl" />
          <span className="font-data block text-xs text-muted">{multiple}× lo que pagas</span>
        </div>
      </div>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5 text-[15px] sm:px-6">
            <dt className="text-muted">{k}</dt>
            <dd className="font-data text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <RateLine className="border-t border-line px-5 py-3 sm:px-6" />
      <span className="absolute -left-3 top-[calc(38%-12px)] hidden h-6 w-6 rounded-full border border-line bg-bg sm:block" aria-hidden />
      <span className="absolute -right-3 top-[calc(38%-12px)] hidden h-6 w-6 rounded-full border border-line bg-bg sm:block" aria-hidden />
    </div>
  );
}
