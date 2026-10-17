"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import { Sheet } from "./Sheet";
import { Confetti, ErrorBadge, RainSpinner, SuccessBurst, WalletPrompt } from "./Celebration";
import { humanError, type HumanError } from "@/lib/format";
import { explorerUrl } from "@/lib/config";

type WriteParams = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

export type TxStep = { label: string; params: WriteParams };
export type TxFlowSpec = {
  key: string;
  title: string;
  steps: TxStep[];
  success: { title: string; body?: React.ReactNode; celebrate?: boolean };
};

type Phase = "wallet" | "chain" | "success" | "error";
type State = {
  flow: TxFlowSpec;
  index: number;
  phase: Phase;
  error?: HumanError;
  hash?: `0x${string}`;
  confirmMs?: number;
};

type Ctx = {
  run: (flow: TxFlowSpec) => Promise<boolean>;
  /** Atajo para una sola transacción. */
  send: (key: string, title: string, params: WriteParams, success?: TxFlowSpec["success"]) => Promise<boolean>;
  /** Celebración sin transacción (por ejemplo, cuando llega un pago por lluvia). */
  celebrate: (success: TxFlowSpec["success"]) => void;
  pending: string | null;
};

const TxContext = createContext<Ctx | null>(null);

export function useTx() {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error("useTx fuera de TxProvider");
  return ctx;
}

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
};

export function TxProvider({ children }: { children: React.ReactNode }) {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const execute = useCallback(
    async (flow: TxFlowSpec, from: number) => {
      for (let i = from; i < flow.steps.length; i++) {
        setState({ flow, index: i, phase: "wallet" });
        try {
          // Los pasos se validan donde se crean; aquí solo se reenvían a wagmi.
          const hash = await writeContractAsync(flow.steps[i].params as Parameters<typeof writeContractAsync>[0]);
          const t0 = performance.now();
          setState({ flow, index: i, phase: "chain", hash });
          const receipt = await client!.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") throw new Error("reverted");
          if (i === flow.steps.length - 1) {
            const confirmMs = performance.now() - t0;
            setState({ flow, index: i, phase: "success", hash, confirmMs });
            vibrate(flow.success.celebrate ? [60, 40, 120] : 40);
          }
        } catch (e) {
          setState({ flow, index: i, phase: "error", error: humanError(e) });
          vibrate([30, 60, 30]);
          await queryClient.invalidateQueries();
          return false;
        }
      }
      await queryClient.invalidateQueries();
      return true;
    },
    [writeContractAsync, client, queryClient],
  );

  const run = useCallback(
    (flow: TxFlowSpec) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        execute(flow, 0).then((ok) => {
          if (ok) resolve(true);
        });
      }),
    [execute],
  );

  const send = useCallback<Ctx["send"]>(
    (key, title, params, success) => run({ key, title, steps: [{ label: title, params }], success: success ?? { title } }),
    [run],
  );

  const celebrate = useCallback((success: TxFlowSpec["success"]) => {
    setState({ flow: { key: "celebrate", title: success.title, steps: [], success: { ...success, celebrate: true } }, index: 0, phase: "success" });
    vibrate([80, 50, 160]);
  }, []);

  const close = useCallback(() => {
    setState((s) => {
      if (s?.phase === "error") resolver.current?.(false);
      return null;
    });
  }, []);

  // El éxito sin celebración se cierra solo.
  useEffect(() => {
    if (state?.phase !== "success" || state.flow.success.celebrate) return;
    const t = setTimeout(close, 2600);
    return () => clearTimeout(t);
  }, [state, close]);

  const busy = state?.phase === "wallet" || state?.phase === "chain";
  const pending = busy ? state!.flow.key : null;

  return (
    <TxContext.Provider value={{ run, send, celebrate, pending }}>
      {children}
      <Sheet open={!!state} onClose={close} label={state?.flow.title ?? "Transacción"} dismissable={!busy}>
        {state && <TxView state={state} onClose={close} onRetry={() => execute(state.flow, state.index).then((ok) => ok && resolver.current?.(true))} />}
      </Sheet>
    </TxContext.Provider>
  );
}

function Elapsed() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setMs(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);
  return <span className="font-data">{(ms / 1000).toFixed(1).replace(".", ",")} s</span>;
}

function TxView({ state, onClose, onRetry }: { state: State; onClose: () => void; onRetry: () => void }) {
  const { flow, index, phase, error, hash, confirmMs } = state;
  const multi = flow.steps.length > 1;
  const step = flow.steps[index];

  return (
    <div className="relative text-center" aria-live="polite">
      {phase === "success" && <Confetti count={flow.success.celebrate ? 70 : 34} />}

      <div className="relative flex justify-center pt-2">
        {phase === "wallet" && <WalletPrompt />}
        {phase === "chain" && <RainSpinner />}
        {phase === "success" && <SuccessBurst />}
        {phase === "error" && <ErrorBadge />}
      </div>

      <div className="relative mt-4">
        {phase === "wallet" && (
          <>
            <h2 className="font-display text-2xl font-extrabold">Confirma en MetaMask</h2>
            <p className="mt-2 text-muted">
              Abre MetaMask y toca <b className="text-ink">Confirmar</b>.
            </p>
            {!multi && <p className="mt-3 inline-block rounded-xl bg-white/[0.05] px-3 py-1.5 text-sm font-semibold">{step.label}</p>}
          </>
        )}
        {phase === "chain" && (
          <>
            <h2 className="font-display text-2xl font-extrabold">Enviando a Monad…</h2>
            <p className="mt-2 text-muted">
              Normalmente tarda menos de un segundo · <Elapsed />
            </p>
          </>
        )}
        {phase === "success" && (
          <>
            <h2 className={`font-display font-extrabold ${flow.success.celebrate ? "text-3xl" : "text-2xl"}`}>{flow.success.title}</h2>
            {flow.success.body && <div className="mt-2 text-muted">{flow.success.body}</div>}
            {confirmMs !== undefined && (
              <p className="font-data mt-3 text-xs text-dim">
                Confirmado en Monad en {(confirmMs / 1000).toFixed(2).replace(".", ",")} s
                {hash && explorerUrl && (
                  <>
                    {" · "}
                    <a className="text-cyan underline" href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer">
                      ver comprobante
                    </a>
                  </>
                )}
              </p>
            )}
          </>
        )}
        {phase === "error" && error && (
          <>
            <h2 className="font-display text-2xl font-extrabold">{error.title}</h2>
            <p className="mt-2 text-muted">{error.body}</p>
          </>
        )}
      </div>

      {multi && phase !== "success" && (
        <ol className="relative mt-6 space-y-2 text-left">
          {flow.steps.map((s, i) => {
            const done = i < index;
            const current = i === index;
            return (
              <li
                key={s.label}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${current ? "border-line-2 bg-white/[0.04]" : "border-transparent"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done ? "bg-ok text-[#04130e]" : current ? (phase === "error" ? "bg-warn text-[#1b0f00]" : "bg-accent text-accent-ink") : "bg-white/5 text-dim"
                  }`}
                >
                  {done ? "✓" : current && phase !== "error" ? <span className="mini-spin" /> : i + 1}
                </span>
                <span className={`text-base ${done ? "text-muted line-through decoration-ok/60" : current ? "font-semibold" : "text-dim"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="relative mt-6 grid gap-2">
        {phase === "success" && (
          <button className="btn btn-accent btn-xl w-full" onClick={onClose} autoFocus>
            {flow.success.celebrate ? "¡Qué bien!" : "Listo"}
          </button>
        )}
        {phase === "error" && (
          <>
            {error?.retry && (
              <button className="btn btn-accent btn-xl w-full" onClick={onRetry} autoFocus>
                Intentar de nuevo
              </button>
            )}
            <button className="btn btn-ghost btn-xl w-full" onClick={onClose}>
              Cerrar
            </button>
          </>
        )}
        {(phase === "wallet" || phase === "chain") && <p className="text-xs text-dim">No cierres esta pantalla mientras se completa.</p>}
      </div>
    </div>
  );
}
