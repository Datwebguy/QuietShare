"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { ADAPTER_EVENTS } from "@web3auth/base";
import { getWeb3Auth } from "@/lib/web3auth";

interface WalletState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  connecting: boolean;
  // True only until the first session check (restoring a still-valid Web3Auth
  // session on load) settles. `address === null` is otherwise ambiguous
  // between "haven't checked yet" and "checked, and you're logged out" —
  // without this, every page that gates on isConnected briefly renders the
  // logged-out view on every refresh before flipping to the real one once
  // restoration finishes, which reads as a flash of the login screen.
  initializing: boolean;
  isConnected: boolean;
  signer: ethers.Signer | null;
  address: string | null;
}

export const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connecting, setConnecting] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const rebuildingRef = useRef(false);

  // Builds an ethers signer from whatever provider Web3Auth currently has,
  // whether that came from an explicit connect() click or a session restored
  // silently on load. Without this, refreshing the page or opening a shared
  // invite link fresh loses the signer even though Web3Auth is still logged
  // in underneath, which is what made balance reads seem to need a re-login.
  const rebuildSigner = useCallback(async () => {
    if (rebuildingRef.current) return;
    rebuildingRef.current = true;
    try {
      const web3auth = await getWeb3Auth();
      if (!web3auth.connected || !web3auth.provider) {
        setSigner(null);
        setAddress(null);
        return;
      }
      const browserProvider = new ethers.BrowserProvider(web3auth.provider);
      const s = await browserProvider.getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
    } finally {
      rebuildingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const web3auth = await getWeb3Auth();

        // Session already restored by initModal() (e.g. a page reload with a
        // still-valid Web3Auth session) — pick it up without another login click.
        if (web3auth.connected) {
          await rebuildSigner();
        }

        const onConnected = () => rebuildSigner();
        const onDisconnected = () => {
          setSigner(null);
          setAddress(null);
        };
        web3auth.on(ADAPTER_EVENTS.CONNECTED, onConnected);
        web3auth.on(ADAPTER_EVENTS.DISCONNECTED, onDisconnected);
        unsubscribe = () => {
          web3auth.off(ADAPTER_EVENTS.CONNECTED, onConnected);
          web3auth.off(ADAPTER_EVENTS.DISCONNECTED, onDisconnected);
        };
      } finally {
        setInitializing(false);
      }
    })();

    return () => unsubscribe?.();
  }, [rebuildSigner]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const web3auth = await getWeb3Auth();
      const provider = await web3auth.connect();
      if (!provider) throw new Error("Web3Auth login was cancelled");
      // The CONNECTED event listener above also fires and rebuilds the signer;
      // rebuilding here too means the caller doesn't have to wait on the event.
      await rebuildSigner();
    } finally {
      setConnecting(false);
    }
  }, [rebuildSigner]);

  const disconnect = useCallback(async () => {
    const web3auth = await getWeb3Auth();
    await web3auth.logout();
    setSigner(null);
    setAddress(null);
  }, []);

  const value: WalletState = {
    connect,
    disconnect,
    connecting,
    initializing,
    isConnected: !!address,
    signer,
    address
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
