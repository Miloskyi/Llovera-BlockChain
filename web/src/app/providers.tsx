"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/config";
import { CurrencyProvider } from "@/lib/currency";
import { ToastProvider } from "@/components/Toast";
import { TxProvider } from "@/components/TxFlow";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CurrencyProvider>
          <ToastProvider>
            <TxProvider>{children}</TxProvider>
          </ToastProvider>
        </CurrencyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
