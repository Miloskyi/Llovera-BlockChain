"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { maxUint256, zeroAddress } from "viem";
import { NotConfigured } from "@/components/NotConfigured";
import { ConnectButton } from "@/components/ConnectButton";
import { Money, RateLine, UsdcNote } from "@/components/Money";
import type { TxStep } from "@/components/TxFlow";
import { llovera, useAllowance, usePoolStats, useTx, useUsdcBalance, usdc } from "@/lib/hooks";
import { useCurrency } from "@/lib/currency";
import { LLOVERA_ADDRESS, chain, contractsConfigured } from "@/lib/config";

export default function Fondo() {
  const { address, isConnected, chainId } = useAccount();
  const ready = isConnected && chainId === chain.id;
  const { data: s } = usePoolStats();
  const { data: balance } = useUsdcBalance();
  const { data: allowance } = useAllowance();
  const { data: shares } = useReadContract({
    ...llovera,
    functionName: "sharesOf",
    args: [address ?? zeroAddress],
    query: { enabled: contractsConfigured && !!address, refetchInterval: 2000 },
  });
  const { data: myValue } = useReadContract({
    ...llovera,
    functionName: "previewRedeem",
    args: [shares ?? 0n],
    query: { enabled: contractsConfigured && !!shares, refetchInterval: 2000 },
  });
  const { run, send, pending } = useTx();
  const { currency, toUsdc } = useCurrency();
  const [amount, setAmount] = useState("");

  const premiums = s ? Number(s.totalPremiums) : 0;
  const payouts = s ? Number(s.totalPayouts) : 0;
  const lossRatio = premiums > 0 ? (payouts / premiums) * 100 : 0;
  const total = s ? Number(s.totalAssets) : 0;
  const lockedPct = total > 0 ? (Number(s!.lockedLiability) / total) * 100 : 0;

  // Monedas sin decimales (COP, CLP, ARS): "50.000" son cincuenta mil. Con decimales, la coma es decimal si aparece.
  const parsed =
    currency.decimals === 0
      ? Number(amount.replace(/\D/g, ""))
      : Number(amount.includes(",") ? amount.replace(/\./g, "").replace(",", ".") : amount);
  const value = Number.isFinite(parsed) && parsed > 0 ? toUsdc(parsed) : 0n;
  const tooMuch = balance !== undefined && value > balance;

  async function deposit() {
    if (value === 0n || tooMuch) return;
    const steps: TxStep[] = [];
    if ((allowance ?? 0n) < value)
      steps.push({ label: "Autorizar el uso de tu saldo", params: { ...usdc, functionName: "approve", args: [LLOVERA_ADDRESS, maxUint256] } });
    steps.push({ label: "Depositar en el fondo", params: { ...llovera, functionName: "deposit", args: [value] } });
    const ok = await run({
      key: "deposit",
      title: "Depositar en el fondo",
      steps,
      success: {
        title: "¡Depósito hecho!",
        body: (
          <>
            Pusiste <Money value={value} className="font-semibold text-ink" /> en el fondo. Desde ya ganas parte de las primas.
          </>
        ),
      },
    });
    if (ok) setAmount("");
  }

  function withdraw(fraction: number) {
    if (!shares || !myValue) return;
    const part = fraction === 1 ? shares : (shares * BigInt(Math.round(fraction * 100))) / 100n;
    const approx = fraction === 1 ? myValue : (myValue * BigInt(Math.round(fraction * 100))) / 100n;
    send("withdraw", "Retirar del fondo", { ...llovera, functionName: "withdraw", args: [part] }, {
      title: "Retiro completado",
      body: (
        <>
          Te llegaron <Money value={approx} className="font-semibold text-ink" /> a tu billetera.
        </>
      ),
    });
  }

  const presets = currency.code === "COP" ? [50_000, 200_000, 500_000] : currency.code === "CLP" || currency.code === "ARS" ? [10_000, 50_000, 100_000] : [10, 50, 100];

  return (
    <div>
      <NotConfigured />
      <div className="rise grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end">
        <div>
          <p className="eyebrow">Fondo de liquidez</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">La plata que paga los aguaceros.</h1>
          <p className="mt-4 text-base text-muted">
            Quien deposita gana las primas de los días secos y asume los pagos de los días de tormenta. Solo se retira la plata que no está respaldando
            coberturas de hoy.
          </p>
        </div>
        <div className="panel p-6">
          <p className="eyebrow">Total en el fondo</p>
          <Money value={s?.totalAssets} className="font-display mt-2 block text-5xl font-extrabold sm:text-6xl" />
          <UsdcNote value={s?.totalAssets} />
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-warn transition-all" style={{ width: `${Math.min(100, lockedPct)}%` }} />
            <div className="h-full bg-ok/70 transition-all" style={{ width: `${100 - Math.min(100, lockedPct)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-muted">
            <span>
              <span className="text-warn">■</span> Respaldando coberturas <Money value={s?.lockedLiability} className="font-data text-ink" />
            </span>
            <span>
              <span className="text-ok">■</span> Libre <Money value={s?.freeLiquidity} className="font-data text-ink" />
            </span>
          </div>
        </div>
      </div>

      <div className="rise mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "100ms" }}>
        <div className="panel p-5">
          <p className="eyebrow">Coberturas</p>
          <p className="font-display mt-2 text-3xl font-extrabold">{s ? s.policyCount.toString() : <span className="skeleton">00</span>}</p>
        </div>
        <div className="panel p-5">
          <p className="eyebrow">Primas cobradas</p>
          <Money value={s?.totalPremiums} className="font-display mt-2 block text-2xl font-extrabold text-ok" />
        </div>
        <div className="panel p-5">
          <p className="eyebrow">Pagos por lluvia</p>
          <Money value={s?.totalPayouts} className="font-display mt-2 block text-2xl font-extrabold text-accent" />
        </div>
        <div className="panel p-5">
          <p className="eyebrow">Siniestralidad</p>
          <p className={`font-display mt-2 text-3xl font-extrabold ${lossRatio > 100 ? "text-bad" : ""}`}>{lossRatio.toFixed(0)}%</p>
        </div>
      </div>

      {!ready ? (
        <div className="panel mt-6 space-y-3 p-5">
          <p className="text-base font-semibold">Conecta MetaMask para depositar en el fondo.</p>
          <ConnectButton size="lg" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="panel p-6">
            <p className="eyebrow">Depositar</p>
            <p className="mt-1 text-base text-muted">
              Tienes <Money value={balance} className="font-semibold text-ink" />
            </p>
            <label className="mt-4 block">
              <span className="sr-only">Monto a depositar en {currency.name}</span>
              <div className="flex items-center gap-2 rounded-2xl border border-line-2 bg-bg-2 px-4 focus-within:outline focus-within:outline-2 focus-within:outline-cyan">
                <span className="text-2xl">{currency.flag}</span>
                <input
                  className="font-display min-h-16 w-full bg-transparent text-3xl font-extrabold outline-none placeholder:text-dim"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                />
                <span className="font-data text-sm text-muted">{currency.code}</span>
              </div>
            </label>
            <div className="mt-2 flex items-center justify-between">
              <UsdcNote value={value} />
              {tooMuch && <span className="text-sm text-warn">No te alcanza el saldo</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <button key={p} className="btn btn-ghost btn-sm" onClick={() => setAmount(String(p))}>
                  {p.toLocaleString(currency.locale)}
                </button>
              ))}
            </div>
            <button className="btn btn-accent btn-xl mt-4 w-full" disabled={value === 0n || tooMuch || pending === "deposit"} onClick={deposit}>
              {pending === "deposit" ? (
                <>
                  <span className="mini-spin" /> Depositando…
                </>
              ) : (
                "Depositar"
              )}
            </button>
            <RateLine className="mt-3" />
          </div>
          <div className="panel p-6">
            <p className="eyebrow">Tu parte del fondo</p>
            <Money value={myValue ?? (shares === 0n ? 0n : undefined)} className="font-display mt-2 block text-4xl font-extrabold" />
            <p className="mt-1 text-sm text-dim">{shares ? `${shares.toLocaleString("es-CO")} participaciones` : "Aún no has depositado"}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[0.25, 0.5, 1].map((f) => (
                <button key={f} className="btn btn-ghost" disabled={!shares || pending === "withdraw"} onClick={() => withdraw(f)}>
                  {f === 1 ? "Todo" : `${f * 100}%`}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-dim">Retirar</p>
          </div>
        </div>
      )}
    </div>
  );
}
