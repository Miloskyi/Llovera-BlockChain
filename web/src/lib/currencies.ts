export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN" | "PEN" | "CLP" | "ARS" | "BRL";

export type Currency = { code: CurrencyCode; name: string; flag: string; locale: string; decimals: number };

export const CURRENCIES: Currency[] = [
  { code: "COP", name: "Peso colombiano", flag: "🇨🇴", locale: "es-CO", decimals: 0 },
  { code: "USD", name: "Dólar", flag: "🇺🇸", locale: "es-CO", decimals: 2 },
  { code: "EUR", name: "Euro", flag: "🇪🇺", locale: "es-ES", decimals: 2 },
  { code: "MXN", name: "Peso mexicano", flag: "🇲🇽", locale: "es-MX", decimals: 2 },
  { code: "PEN", name: "Sol peruano", flag: "🇵🇪", locale: "es-PE", decimals: 2 },
  { code: "CLP", name: "Peso chileno", flag: "🇨🇱", locale: "es-CL", decimals: 0 },
  { code: "ARS", name: "Peso argentino", flag: "🇦🇷", locale: "es-AR", decimals: 0 },
  { code: "BRL", name: "Real brasileño", flag: "🇧🇷", locale: "pt-BR", decimals: 2 },
];

/** Tasas aproximadas (USD → moneda) por si la API de tasas no responde. */
export const FALLBACK_RATES: Record<CurrencyCode, number> = {
  COP: 3180,
  USD: 1,
  EUR: 0.89,
  MXN: 18.5,
  PEN: 3.43,
  CLP: 980,
  ARS: 1500,
  BRL: 5.1,
};

export type RatesPayload = { rates: Record<string, number>; updatedAt: number | null; live: boolean };
