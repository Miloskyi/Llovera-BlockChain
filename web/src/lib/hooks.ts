"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import { lloveraAbi, usdcAbi } from "./abi";
import { LLOVERA_ADDRESS, USDC_ADDRESS, contractsConfigured } from "./config";

const live = { refetchInterval: 2000, enabled: contractsConfigured } as const;

export const llovera = { address: LLOVERA_ADDRESS, abi: lloveraAbi } as const;
export const usdc = { address: USDC_ADDRESS, abi: usdcAbi } as const;

export function useProductConfig() {
  return useReadContract({ ...llovera, functionName: "config", query: live });
}

/** Tarifa en MON nativo que se envía junto con cada compra de cobertura. */
export function usePolicyFee() {
  return useReadContract({ ...llovera, functionName: "policyFee", query: { enabled: contractsConfigured, staleTime: 60_000 } });
}

export function useZonesOnChain() {
  return useReadContract({ ...llovera, functionName: "getZones", query: { enabled: contractsConfigured, staleTime: 60_000 } });
}

export function useDashboard() {
  const { address } = useAccount();
  return useReadContract({ ...llovera, functionName: "dashboard", args: [address ?? zeroAddress], query: live });
}

export function useMyPolicies() {
  const { address } = useAccount();
  return useReadContract({
    ...llovera,
    functionName: "policiesDetailOf",
    args: [address ?? zeroAddress],
    query: { ...live, enabled: contractsConfigured && !!address },
  });
}

/** Coberturas de una zona en un día (todas las wallets), para el panel del oráculo. */
export function useZonePolicies(zoneId: number, day: bigint | undefined) {
  const ids = useReadContract({
    ...llovera,
    functionName: "zoneDayPolicies",
    args: [BigInt(zoneId), day ?? 0n],
    query: { ...live, enabled: contractsConfigured && day !== undefined },
  });
  const list = ids.data ?? [];
  const details = useReadContracts({
    contracts: list.map((id) => ({ ...llovera, functionName: "getPolicy", args: [id] }) as const),
    query: { ...live, enabled: list.length > 0 },
  });
  return (details.data ?? []).flatMap((r) => (r.status === "success" ? [r.result] : []));
}

export function usePoolStats() {
  return useReadContract({ ...llovera, functionName: "poolStats", query: live });
}

export function useUsdcBalance() {
  const { address } = useAccount();
  return useReadContract({
    ...usdc,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { ...live, enabled: contractsConfigured && !!address },
  });
}

export function useAllowance() {
  const { address } = useAccount();
  return useReadContract({
    ...usdc,
    functionName: "allowance",
    args: [address ?? zeroAddress, LLOVERA_ADDRESS],
    query: { ...live, enabled: contractsConfigured && !!address },
  });
}

export function useIsOracle() {
  const { address } = useAccount();
  const role = useReadContract({ ...llovera, functionName: "ORACLE_ROLE", query: { enabled: contractsConfigured } });
  return useReadContract({
    ...llovera,
    functionName: "hasRole",
    args: [role.data ?? "0x0000000000000000000000000000000000000000000000000000000000000000", address ?? zeroAddress],
    query: { enabled: contractsConfigured && !!address && !!role.data },
  });
}

export function useIsAdmin() {
  const { address } = useAccount();
  return useReadContract({
    ...llovera,
    functionName: "hasRole",
    args: ["0x0000000000000000000000000000000000000000000000000000000000000000", address ?? zeroAddress],
    query: { enabled: contractsConfigured && !!address },
  });
}

export { useTx } from "@/components/TxFlow";
