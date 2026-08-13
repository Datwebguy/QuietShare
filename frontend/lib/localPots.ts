"use client";

/** Client-side "which pots have I created/joined" list — no backend/indexer in
 *  v1, so this is just localStorage. The source of truth for membership is
 *  always the on-chain PotVault.isMember() check; this only drives the UI's
 *  "my pots" list on the dashboard.
 *
 *  Keyed per wallet address: the same browser is routinely shared across
 *  accounts (different Google/Apple logins via Web3Auth), and an unscoped
 *  key leaked every pot any prior account on that device had touched into
 *  the next account's "Your pots" list. */

export interface KnownPot {
  potId: string;
  name: string;
}

function storageKey(address: string): string {
  return `quietshare:known-pots:${address.toLowerCase()}`;
}

export function getKnownPots(address: string | null | undefined): KnownPot[] {
  if (typeof window === "undefined" || !address) return [];
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(address)) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberPot(address: string, pot: KnownPot) {
  const existing = getKnownPots(address);
  if (existing.some((p) => p.potId === pot.potId)) return;
  window.localStorage.setItem(storageKey(address), JSON.stringify([...existing, pot]));
}
