"use client";

import { useCallback, useContext } from "react";
import { WalletContext } from "@/components/WalletProvider";

/** Re-exported for convenience; the real state lives in WalletProvider's context. */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  const { connect, disconnect, connecting, initializing, isConnected, signer, address } = ctx;
  return {
    connect: useCallback(() => connect(), [connect]),
    disconnect,
    connecting,
    initializing,
    isConnected,
    signer,
    address
  };
}
