"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { formatEther } from "viem";
import { chain } from "@/lib/config";
import { shortAddr } from "@/lib/format";

const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function ConnectButton({ size = "md", compact = false }: { size?: "md" | "lg"; compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: mon } = useBalance({ address, query: { enabled: !!address, refetchInterval: 5000 } });
  const big = size === "lg" ? "btn-xl w-full" : "";

  if (!mounted) return <div className={`skeleton h-10 ${compact ? "w-28" : "w-44"}`} />;

  if (!isConnected) {
    const hasWallet = "ethereum" in window;
    if (!hasWallet) {
      // En el celular, abrir la página dentro del navegador de la app de MetaMask.
      const href = isMobile() ? `https://metamask.app.link/dapp/${location.host}${location.pathname}` : "https://metamask.io/download/";
      return (
        <a className={`btn btn-accent ${big}`} href={href} target={isMobile() ? undefined : "_blank"} rel="noreferrer">
          <MetaMaskGlyph />
          {isMobile() ? (compact ? "Abrir" : "Abrir en MetaMask") : compact ? "MetaMask" : "Instalar MetaMask"}
        </a>
      );
    }
    return (
      <button className={`btn btn-accent ${big}`} disabled={isPending} onClick={() => connect({ connector: connectors[0], chainId: chain.id })}>
        {isPending ? <span className="mini-spin" /> : <MetaMaskGlyph />}
        {isPending ? "Conectando…" : compact ? "Conectar" : "Conectar MetaMask"}
      </button>
    );
  }

  if (chainId !== chain.id) {
    return (
      <button className={`btn btn-storm ${big}`} disabled={switching} onClick={() => switchChain({ chainId: chain.id })}>
        {switching && <span className="mini-spin" />}
        {switching ? "Cambiando…" : compact ? "Cambiar red" : `Cambiar a ${chain.name}`}
      </button>
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

function MetaMaskGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M21 3l-7.5 5.5 1.4-3.3L21 3zM3 3l7.4 5.6-1.3-3.4L3 3z" fill="currentColor" opacity=".8" />
      <path d="M18.3 16.4l-2 3 4.3 1.2 1.2-4.1-3.5-.1zM2.2 16.5l1.2 4.1 4.3-1.2-2-3-3.5.1z" fill="currentColor" />
      <path d="M7.5 11.2l-1.2 1.8 4.3.2-.2-4.6-2.9 2.6zM16.5 11.2l-3-2.7-.1 4.7 4.3-.2-1.2-1.8z" fill="currentColor" opacity=".9" />
    </svg>
  );
}
