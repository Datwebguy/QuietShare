"use client";

import { ethers } from "ethers";
import { usePotContext } from "@/components/PotProvider";
import { short, TOKEN_DECIMALS } from "@/lib/usePot";
import { useUsernames, nameOrShort } from "@/lib/useUsernames";
import { COSTON2_EXPLORER_URL } from "@/lib/chain";

export default function ActivityPage() {
  const { activity, address, signer, refreshingActivity, refreshActivityManually, error } = usePotContext();
  const { displayName } = useUsernames(
    signer,
    activity.map((item) => item.who)
  );

  const sentToMe = address ? activity.filter((item) => item.type === "payout" && item.who.toLowerCase() === address.toLowerCase()) : [];
  const totalSentToMe = sentToMe.reduce((sum, item) => sum + item.amount, 0n);

  return (
    <>
      {address && sentToMe.length > 0 && (
        <section className="rounded-2xl border border-pot-200 bg-pot-50 p-4">
          <h2 className="font-semibold text-pot-700">Sent to you</h2>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
            {ethers.formatUnits(totalSentToMe, TOKEN_DECIMALS)}
            <span className="ml-2 text-sm font-medium text-slate-500">FXRP total</span>
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-pot-100">
            {sentToMe.map((item) => (
              <li key={item.txHash} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm text-ink">Payout</span>
                <a
                  href={`${COSTON2_EXPLORER_URL}/tx/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-semibold text-pot-700 underline"
                >
                  {ethers.formatUnits(item.amount, TOKEN_DECIMALS)} FXRP
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Activity</h2>
          <button
            onClick={refreshActivityManually}
            disabled={refreshingActivity}
            aria-label="Refresh activity"
            title="Refresh activity"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 ${refreshingActivity ? "animate-spin" : ""}`}>
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
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {activity.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">
            No deposits or payouts yet, or this list just hasn't caught up yet. If someone told you they deposited or a
            payment went out and it's not showing, tap refresh above before assuming it didn't happen.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-slate-100">
            {activity.map((item) => {
              const isMe = !!address && item.who.toLowerCase() === address.toLowerCase();
              return (
                <li key={item.txHash} className="flex items-center gap-2 py-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                      item.type === "deposit" ? "bg-pot-100 text-pot-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.type === "deposit" ? "+" : "-"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isMe ? "font-semibold text-pot-700" : ""}`}>
                      {item.type === "deposit" ? "Deposit from " : "Paid out to "}
                      <span className="font-mono text-xs">
                        {isMe ? "you" : nameOrShort(displayName(item.who), short(item.who))}
                      </span>
                    </p>
                  </div>
                  <a
                    href={`${COSTON2_EXPLORER_URL}/tx/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-semibold text-pot-700 underline"
                  >
                    {ethers.formatUnits(item.amount, TOKEN_DECIMALS)} FXRP
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
