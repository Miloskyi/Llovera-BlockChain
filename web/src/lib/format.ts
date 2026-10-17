import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  InsufficientFundsError,
  TimeoutError,
  UserRejectedRequestError,
  formatUnits,
} from "viem";

export const usd = (v: bigint | undefined, digits = 2) =>
  v === undefined ? "—" : Number(formatUnits(v, 6)).toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const mm = (x10: number | bigint | undefined) => (x10 === undefined ? "—" : (Number(x10) / 10).toFixed(1));

/** Segundos desde medianoche → "6:00 a. m." */
export const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

export const duration = (seconds: number) => {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)} h`;
};

export const shortAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const SALES_STATUS: { label: string; tone: "ok" | "warn" | "off" }[] = [
  { label: "Disponible", tone: "ok" },
  { label: "Zona sin cobertura", tone: "off" },
  { label: "Fuera del horario de compra (6 a 9 a. m.)", tone: "off" },
  { label: "La cobertura de hoy ya terminó", tone: "off" },
  { label: "Riesgo de tormenta muy alto hoy", tone: "warn" },
  { label: "Está lloviendo: vuelve cuando escampe", tone: "warn" },
  { label: "Se agotaron los cupos de esta zona hoy", tone: "warn" },
  { label: "El fondo no tiene cupo ahora", tone: "warn" },
  { label: "Ya estás protegido hoy", tone: "ok" },
];

export type HumanError = { title: string; body: string; retry: boolean };

const CONTRACT_ERRORS: Record<string, Omit<HumanError, "retry">> = {
  NotEligible: { title: "Todavía no aplica el pago", body: "La lluvia fuerte cayó antes de que tu cobertura estuviera activa." },
  AlreadyPaid: { title: "Ya te pagamos", body: "Esta cobertura ya recibió su pago. Revisa tu saldo." },
  InsufficientFreeLiquidity: {
    title: "Esa plata está comprometida",
    body: "Parte del fondo respalda coberturas de hoy. Intenta retirar un monto menor o espera a que termine el día.",
  },
  FaucetCooldown: { title: "Ya reclamaste hoy", body: "El saldo de prueba gratis se puede pedir una vez cada 24 horas." },
  AccessControlUnauthorizedAccount: { title: "Sin permiso", body: "Esta cuenta no puede hacer esta acción. Usa la cuenta del oráculo." },
  ERC20InsufficientBalance: { title: "No te alcanza el saldo", body: "Pide saldo de prueba gratis en Mi turno y vuelve a intentarlo." },
  ERC20InsufficientAllowance: { title: "Falta la autorización", body: "Vuelve a intentarlo y acepta primero el permiso de uso de saldo." },
  ZeroAmount: { title: "Monto inválido", body: "Escribe un monto mayor a cero." },
  AlreadyFinalized: { title: "Ese día ya se cerró", body: "Las coberturas de ese día ya fueron liquidadas." },
  WrongFee: { title: "La tarifa cambió", body: "Recarga la página para ver la tarifa en MON actualizada e intenta de nuevo." },
};

/** Convierte cualquier error de wallet, red o contrato en un mensaje que entienda cualquier persona. */
export function humanError(e: unknown): HumanError {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError) || /rejected|denied|cancel/i.test(e.shortMessage))
      return { title: "Cancelaste la operación", body: "No se hizo ningún cobro. Puedes intentarlo cuando quieras.", retry: true };
    if (e.walk((x) => x instanceof InsufficientFundsError) || /insufficient funds/i.test(e.message))
      return { title: "Te falta MON", body: "Asegurarte cuesta una pequeña tarifa en MON más la comisión de red. Pide MON gratis en el faucet de Monad.", retry: true };
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name === "SalesClosed") {
        const status = SALES_STATUS[Number(reverted.data?.args?.[0] ?? 0)];
        return { title: "No se pudo asegurar ahora", body: status?.label ?? "La venta está cerrada en este momento.", retry: false };
      }
      if (name && CONTRACT_ERRORS[name]) return { ...CONTRACT_ERRORS[name], retry: false };
      return { title: "La operación no pasó", body: "El contrato la rechazó. Revisa los datos e intenta de nuevo.", retry: true };
    }
    if (e.walk((x) => x instanceof HttpRequestError || x instanceof TimeoutError) || /fetch|network|timeout/i.test(e.message))
      return { title: "Sin conexión con Monad", body: "Revisa tu señal o tus datos móviles e intenta de nuevo.", retry: true };
    if (/chain|network.*mismatch/i.test(e.message))
      return { title: "Estás en otra red", body: "Cambia MetaMask a la red de Lloverá e intenta de nuevo.", retry: true };
  }
  if (e instanceof Error && /reverted/i.test(e.message))
    return { title: "La operación no pasó", body: "La red rechazó la transacción. No se te cobró el monto.", retry: true };
  return { title: "Algo salió mal", body: "No pudimos completar la operación. Intenta de nuevo en unos segundos.", retry: true };
}

/** Versión corta para avisos. */
export const errorMessage = (e: unknown) => humanError(e).title;
