import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
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
  // injected: extensión de escritorio o navegador interno de MetaMask.
  // metaMask (SDK): Chrome/Safari del celular, abre la app para aprobar y vuelve a la página.
  connectors: [
    injected({ target: "metaMask" }),
    metaMask({ dappMetadata: { name: "Lloverá", url: "https://llovera-kappa.vercel.app" } }),
  ],
  transports: { [monadTestnet.id]: http(rpcUrl), [foundry.id]: http(rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
