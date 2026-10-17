"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { explorerUrl } from "@/lib/config";

type Toast = { id: number; tone: "ok" | "error" | "rain"; title: string; body?: string; hash?: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<Ctx>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TONES = {
  ok: { bar: "var(--ok)", icon: "✓" },
  error: { bar: "var(--bad)", icon: "!" },
  rain: { bar: "var(--accent)", icon: "⛈" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.tone === "rain" ? 10000 : 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-[400px]" aria-live="polite">
        {toasts.map((t) => {
          const tone = TONES[t.tone];
          return (
            <div
              key={t.id}
              className={`toast-in panel flex w-full gap-3 p-4 ${t.tone === "rain" ? "border-accent/60" : ""}`}
              style={t.tone === "rain" ? { boxShadow: "0 20px 60px -20px rgba(255,212,59,.45)" } : undefined}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: tone.bar, color: t.tone === "rain" ? "var(--accent-ink)" : "#04130e" }}
              >
                {tone.icon}
              </span>
              <div className="min-w-0">
                <p className={`font-semibold ${t.tone === "rain" ? "font-display text-lg" : ""}`}>{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                {t.hash && explorerUrl && (
                  <a className="font-data mt-1 inline-block text-xs text-cyan underline" href={`${explorerUrl}/tx/${t.hash}`} target="_blank" rel="noreferrer">
                    Ver transacción ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
