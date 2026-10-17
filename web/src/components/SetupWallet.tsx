"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { chain } from "@/lib/config";
import { useUsdcBalance } from "@/lib/hooks";
import { ConnectButton } from "./ConnectButton";

function Step({ done, n, title, children, last }: { done: boolean; n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-4">
      {!last && <span className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-line-2" aria-hidden />}
      <span
        className={`font-data relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold ${
          done ? "border-ok bg-ok/15 text-ok" : "border-line-2 text-muted"
        }`}
      >
        {done ? "✓" : `0${n}`}
      </span>
      <div className="pb-6">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

/** Lista para dejar MetaMask lista; cada paso se marca solo. */
export function SetupWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { isConnected, chainId, address } = useAccount();
  const { data: mon } = useBalance({ address, query: { enabled: !!address } });
  const { data: tusdc } = useUsdcBalance();

  const connected = mounted && isConnected;
  const onChain = connected && chainId === chain.id;
  const hasMon = onChain && !!mon && mon.value > 0n;
  const hasUsdc = onChain && !!tusdc && tusdc > 0n;

  return (
    <div className="panel p-6">
      <ol>
        <Step n={1} done={connected} title="Conecta MetaMask">
          <div className="mt-2">
            <ConnectButton />
          </div>
        </Step>
        <Step n={2} done={onChain} title={`Cambia a ${chain.name}`}>
          Si MetaMask no tiene la red, el botón la agrega (chain ID <span className="font-data">{chain.id}</span>).
        </Step>
        <Step n={3} done={hasMon} title="Ten MON para el gas">
          Cuesta fracciones de centavo. Si no tienes, pide en el{" "}
          <a className="text-cyan underline" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
            faucet de Monad
          </a>
          .
        </Step>
        <Step n={4} done={hasUsdc} title="Pide saldo de prueba gratis" last>
          En{" "}
          <Link className="text-cyan underline" href="/asegurar">
            Mi turno
          </Link>{" "}
          tocas «Saldo de prueba» y te llega dinero de prueba (tUSDC) una vez al día.
        </Step>
      </ol>
    </div>
  );
}
