import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { foundry, monadTestnet } from "viem/chains";
import type { Address } from "viem";

const isLocal = process.env.NEXT_PUBLIC_CHAIN_ID === "31337";

export const chain = isLocal ? foundry : monadTestnet;
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0];
export const explorerUrl = isLocal ? null : monadTestnet.blockExplorers.default.url;

export const LLOVERA_ADDRESS = (process.env.NEXT_PUBLIC_LLOVERA_ADDRESS || "") as Address;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "") as Address;
export const contractsConfigured = LLOVERA_ADDRESS.startsWith("0x") && USDC_ADDRESS.startsWith("0x");

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected({ target: "metaMask" })],
  transports: { [monadTestnet.id]: http(rpcUrl), [foundry.id]: http(rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
