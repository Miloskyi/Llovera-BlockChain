"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { formatEther } from "viem";
import { chain, rpcUrl } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { Sheet } from "./Sheet";

const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function ConnectButton({ size = "md", compact = false }: { size?: "md" | "lg"; compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [help, setHelp] = useState(false);
  const { data: mon } = useBalance({ address, query: { enabled: !!address, refetchInterval: 5000 } });
  const big = size === "lg" ? "btn-xl w-full" : "";

  if (!mounted) return <div className={`skeleton h-10 ${compact ? "w-28" : "w-44"}`} />;

  if (!isConnected) {
    const hasWallet = "ethereum" in window;
    if (!hasWallet && !isMobile()) {
      return (
        <a className={`btn btn-accent ${big}`} href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          <MetaMaskGlyph />
          {compact ? "MetaMask" : "Instalar MetaMask"}
        </a>
      );
    }
    // Sin wallet inyectada en el celular: el SDK abre la app de MetaMask para aprobar y regresa aquí.
    const connector = hasWallet ? connectors.find((c) => c.type === "injected") : connectors.find((c) => c.type === "metaMask");
    return (
      <button className={`btn btn-accent ${big}`} disabled={isPending} onClick={() => connect({ connector: connector ?? connectors[0], chainId: chain.id })}>
        {isPending ? <span className="mini-spin" /> : <MetaMaskGlyph />}
        {isPending ? "Conectando…" : compact ? "Conectar" : "Conectar MetaMask"}
      </button>
    );
  }

  if (chainId !== chain.id) {
    // En el celular MetaMask a veces se abre sin mostrar la solicitud: dejamos los pasos manuales a mano.
    const trySwitch = () => {
      switchChain({ chainId: chain.id });
      if (isMobile()) setHelp(true);
    };
    return (
      <>
        <button className={`btn btn-storm ${big}`} onClick={trySwitch}>
          {switching && <span className="mini-spin" />}
          {switching ? "Cambiando…" : compact ? "Cambiar red" : `Cambiar a ${chain.name}`}
        </button>
        <Sheet open={help} onClose={() => setHelp(false)} label={`Cambiar a ${chain.name}`}>
          <SwitchHelp onRetry={() => switchChain({ chainId: chain.id })} />
        </Sheet>
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-data hidden rounded-xl border border-line px-3 py-2 text-xs text-muted lg:inline">
        {mon ? `${Number(formatEther(mon.value)).toFixed(3)} MON` : "…"}
      </span>
      <button className={`btn btn-ghost font-data ${big} ${compact ? "px-3" : ""}`} onClick={() => disconnect()} title="Desconectar">
        <span className="live-dot" />
        {compact ? `${address?.slice(0, 5)}…${address?.slice(-3)}` : shortAddr(address)}
      </button>
    </div>
  );
}

function SwitchHelp({ onRetry }: { onRetry: () => void }) {
  // Con el SDK la página está en Chrome/Safari; con injected ya estamos dentro de MetaMask.
  const inMetaMask = useAccount().connector?.type === "injected";
  const openInMetaMask = `https://link.metamask.io/dapp/${location.host}${location.pathname}`;
  const fields = [
    ["Nombre de la red", chain.name],
    ["URL de RPC", rpcUrl],
    ["ID de cadena", String(chain.id)],
    ["Símbolo", chain.nativeCurrency.symbol],
    ["Explorador", chain.blockExplorers?.default.url ?? ""],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-extrabold">Cambia a {chain.name}</h2>
        <p className="mt-1 text-base text-muted">
          Te enviamos la solicitud a MetaMask. Si la app se abrió y no te mostró nada, hazlo a mano. Al volver, la página se actualiza sola.
        </p>
      </div>
      {!inMetaMask && (
        <a className="btn btn-accent btn-xl w-full" href={openInMetaMask}>
          <MetaMaskGlyph /> Abrir Lloverá dentro de MetaMask
        </a>
      )}
      <ol className="list-decimal space-y-1 pl-5 text-base text-muted">
        <li>En MetaMask, toca el selector de red arriba.</li>
        <li>
          Busca <b className="text-ink">{chain.name}</b> y selecciónala.
        </li>
        <li>Si no aparece, toca «Agregar red personalizada» y copia estos datos:</li>
      </ol>
      <div className="divide-y divide-line rounded-2xl border border-line">
        {fields.map(([label, value]) => (
          <button
            key={label}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left"
            onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}
          >
            <span className="text-sm text-dim">{label}</span>
            <span className="font-data min-w-0 truncate text-sm">{value}</span>
            <span className="text-xs text-cyan">Copiar</span>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost w-full" onClick={onRetry}>
        Volver a intentar
      </button>
    </div>
  );
}

function MetaMaskGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M21 3l-7.5 5.5 1.4-3.3L21 3zM3 3l7.4 5.6-1.3-3.4L3 3z" fill="currentColor" opacity=".8" />
      <path d="M18.3 16.4l-2 3 4.3 1.2 1.2-4.1-3.5-.1zM2.2 16.5l1.2 4.1 4.3-1.2-2-3-3.5.1z" fill="currentColor" />
      <path d="M7.5 11.2l-1.2 1.8 4.3.2-.2-4.6-2.9 2.6zM16.5 11.2l-3-2.7-.1 4.7 4.3-.2-1.2-1.8z" fill="currentColor" opacity=".9" />
    </svg>
  );
}
