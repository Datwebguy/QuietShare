"use client";

import { useState } from "react";
import { usePotContext } from "@/components/PotProvider";
import { short } from "@/lib/usePot";
import { useUsernames, nameOrShort } from "@/lib/useUsernames";
import { CONTRACTS, COSTON2_EXPLORER_URL } from "@/lib/chain";

export default function MembersPage() {
  const { members, address, signer, refreshingMembers, refreshMembersManually } = usePotContext();
  const { displayName } = useUsernames(signer, members);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  async function copyMemberAddress(m: string) {
    await navigator.clipboard.writeText(m);
    setCopiedAddress(m);
    setTimeout(() => setCopiedAddress((current) => (current === m ? null : current)), 1500);
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Members ({members.length})</h2>
          <button
            onClick={refreshMembersManually}
            disabled={refreshingMembers}
            aria-label="Refresh members"
            title="Refresh members"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 ${refreshingMembers ? "animate-spin" : ""}`}>
              <path
                d="M4 4v5h5M20 20v-5h-5M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9a8 8 0 0 0-14.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Tap the copy icon to grab an address for the Send screen.</p>
        <ul className="mt-2 flex flex-col divide-y divide-slate-100">
          {members.map((m) => {
            const isMe = !!address && m.toLowerCase() === address.toLowerCase();
            const copied = copiedAddress === m;
            return (
              <li key={m} className="flex items-center gap-2 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pot-100 text-xs font-semibold text-pot-700">
                  {m.slice(2, 4).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={m}>
                  <span className="font-mono">{nameOrShort(displayName(m), short(m))}</span>
                  {isMe && <span className="ml-1.5 text-slate-400">(you)</span>}
                </span>
                <a
                  href={`${COSTON2_EXPLORER_URL}/address/${m}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${short(m)} on the block explorer`}
                  title="View on block explorer"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                    <path
                      d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
                <button
                  onClick={() => copyMemberAddress(m)}
                  aria-label={`Copy ${short(m)}'s address`}
                  title="Copy address"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90"
                >
                  {copied ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <a
        href={`${COSTON2_EXPLORER_URL}/address/${CONTRACTS.vault}`}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-slate-400 underline"
      >
        What's public onchain (PotVault contract) →
      </a>
    </>
  );
}
