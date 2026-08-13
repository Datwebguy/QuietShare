"use client";

import { ethers } from "ethers";
import { usePotContext } from "@/components/PotProvider";
import { short, TOKEN_DECIMALS } from "@/lib/usePot";
import { useUsernames, nameOrShort } from "@/lib/useUsernames";

export default function SendPage() {
  const {
    spendTo,
    setSpendTo,
    spendToValid,
    spendAmount,
    setSpendAmount,
    spendAmountValid,
    spendExceedsPotBalance,
    canPropose,
    spendMemo,
    setSpendMemo,
    proposeSpend,
    approveSpend,
    proposals,
    members,
    potBalance,
    signer,
    error,
    status,
    refreshingProposals,
    refreshProposalsManually
  } = usePotContext();
  const { displayName } = useUsernames(
    signer,
    proposals.map((p) => p.to)
  );
  const { displayName: memberName } = useUsernames(signer, members);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Send from this pot</h2>
        <button
          onClick={refreshProposalsManually}
          disabled={refreshingProposals}
          aria-label="Refresh proposals"
          title="Refresh proposals"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 ${refreshingProposals ? "animate-spin" : ""}`}>
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
      <p className="mt-1 text-xs text-slate-400">
        Propose a payment. It sends automatically once more than half the group approves.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {status && <p className="mt-3 text-sm text-slate-500">{status}</p>}

      <div className="mt-3 flex flex-col gap-2">
        <div>
          <input
            autoComplete="off"
            placeholder="Recipient address (0x...)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-xs focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
            value={spendTo}
            onChange={(e) => setSpendTo(e.target.value)}
          />
          {spendTo.trim() !== "" && !spendToValid && (
            <p className="mt-1 text-xs text-red-600">That doesn't look like a valid wallet address.</p>
          )}
          {members.length > 0 && (
            <div className="mt-1.5">
              <p className="mb-1 text-xs text-slate-400">Or pick a member:</p>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const selected = spendTo.trim().toLowerCase() === m.toLowerCase();
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSpendTo(m)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${
                        selected
                          ? "border-pot-600 bg-pot-50 text-pot-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-pot-300"
                      }`}
                    >
                      {nameOrShort(memberName(m), short(m))}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount in FXRP"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
            value={spendAmount}
            onChange={(e) => setSpendAmount(e.target.value)}
          />
          <button
            onClick={proposeSpend}
            disabled={!canPropose}
            className="shrink-0 rounded-xl bg-pot-600 px-5 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            Propose
          </button>
        </div>
        {spendExceedsPotBalance && (
          <p className="text-xs text-red-600">
            That's more than the pot currently holds
            {potBalance !== null ? ` (${ethers.formatUnits(potBalance, TOKEN_DECIMALS)} FXRP available)` : ""}.
          </p>
        )}
        <input
          autoComplete="off"
          placeholder="What is this for? (optional)"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
          value={spendMemo}
          onChange={(e) => setSpendMemo(e.target.value)}
        />
      </div>

      {proposals.length === 0 && (
        <p className="mt-4 text-xs text-slate-400">
          No pending proposals, or this list just hasn't caught up yet. If someone told you they proposed a payment
          and it's not showing, tap refresh above before assuming it didn't happen.
        </p>
      )}

      {proposals.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {proposals.map((p) => {
            // The contract lets everyone approve regardless of the pot's
            // current balance. It only checks funds at the moment the
            // majority-crossing approval tries to execute. If the pot has
            // since been spent down below what this proposal asks for, that
            // final approval reverts on chain, and the only person who ever
            // sees why is whoever's browser happened to trigger it. To
            // everyone else the proposal just looks permanently stuck.
            // Surfacing it here means anyone looking at the list can see why.
            const insufficientFunds = !p.executed && potBalance !== null && p.amount > potBalance;
            return (
              <li key={p.proposalId} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {ethers.formatUnits(p.amount, TOKEN_DECIMALS)} FXRP to{" "}
                      {nameOrShort(displayName(p.to), short(p.to))}
                    </p>
                    {p.memo && <p className="mt-0.5 text-xs text-slate-500">{p.memo}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {p.executed
                        ? "Sent automatically. Check the recipient's wallet or the activity screen"
                        : `${p.approvalCount} of ${members.length} approved · sends automatically once approved`}
                    </p>
                    {insufficientFunds && (
                      <p className="mt-1 text-xs text-red-600">
                        The pot only holds {ethers.formatUnits(potBalance!, TOKEN_DECIMALS)} FXRP right now, this
                        can't go out until someone deposits enough to cover it.
                      </p>
                    )}
                  </div>
                  {!p.executed && !p.approvedByMe && (
                    <button
                      onClick={() => approveSpend(p.proposalId)}
                      className="shrink-0 rounded-lg bg-pot-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                    >
                      Approve
                    </button>
                  )}
                  {!p.executed && p.approvedByMe && (
                    <span className="shrink-0 rounded-lg bg-pot-100 px-3 py-1.5 text-xs font-semibold text-pot-700">
                      Approved
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
