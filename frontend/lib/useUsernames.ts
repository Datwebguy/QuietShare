"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getUsernameRegistryContract } from "./contracts";

/** Batch-looks-up display names for a list of addresses against
 *  UsernameRegistry. Purely cosmetic and best-effort: a lookup failure for
 *  one address just leaves it showing the raw address, same as if no name
 *  had been set — never blocks or errors the screen that's using it. */
export function useUsernames(signer: ethers.Signer | null, addresses: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = [...new Set(addresses.map((a) => a.toLowerCase()))].sort().join(",");

  useEffect(() => {
    if (!signer || !key) return;
    let cancelled = false;
    (async () => {
      const registry = getUsernameRegistryContract(signer);
      const unique = key.split(",");
      const results = await Promise.all(
        unique.map(async (addr) => {
          try {
            const name: string = await registry.nameOf(addr);
            return [addr, name] as const;
          } catch {
            return [addr, ""] as const;
          }
        })
      );
      if (!cancelled) {
        setNames((prev) => {
          const next = { ...prev };
          for (const [addr, name] of results) next[addr] = name;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signer, key]);

  function displayName(address: string): string {
    return names[address.toLowerCase()] || "";
  }

  return { displayName };
}

/** "Alex (0x1234…abcd)" if a name is set, otherwise just the short address. */
export function nameOrShort(name: string, short: string): string {
  return name ? `${name} (${short})` : short;
}

export async function setMyUsername(signer: ethers.Signer, name: string) {
  const registry = getUsernameRegistryContract(signer);
  const tx = await registry.setName(name);
  await tx.wait();
}
