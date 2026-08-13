"use client";

import { createContext, useContext } from "react";
import { usePot, type PotData } from "@/lib/usePot";

const PotContext = createContext<PotData | null>(null);

export function PotProvider({ potId, children }: { potId: string; children: React.ReactNode }) {
  const pot = usePot(potId);
  return <PotContext.Provider value={pot}>{children}</PotContext.Provider>;
}

export function usePotContext(): PotData {
  const ctx = useContext(PotContext);
  if (!ctx) throw new Error("usePotContext must be used within <PotProvider>");
  return ctx;
}
