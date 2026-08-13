"use client";

import { ethers } from "ethers";
import { usePotContext } from "@/components/PotProvider";
import { TOKEN_DECIMALS } from "@/lib/usePot";

export default function PotOverviewPage() {
  const { initializing, balance, loadingBalance, refreshBalance, potBalance, error, status } = usePotContext();

  if (initializing) return null; // PotChrome (rendered by the layout) already shows the loading state.

  return (
    <>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {status && <p className="text-sm text-slate-500">{status}</p>}

      <section className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your private balance</p>
        <p className="mt-1 text-xs text-slate-400">
          The app only shows this number to you, not to other members. It goes down when the pot pays something out.
        </p>

        {balance ? (
          <p className="mt-4 text-4xl font-bold tabular-nums text-ink">
            {ethers.formatUnits(balance.balance, TOKEN_DECIMALS)}
            <span className="ml-2 text-lg font-medium text-slate-400">FXRP</span>
          </p>
        ) : (
          <p className="mt-4 text-2xl font-semibold text-slate-300">Not fetched yet</p>
        )}

        {balance && (
          <p className="mt-1 text-xs text-slate-400">
            Total deposited: {ethers.formatUnits(balance.totalDeposited, TOKEN_DECIMALS)} FXRP
          </p>
        )}

        <button
          onClick={refreshBalance}
          disabled={loadingBalance}
          className="mt-5 w-full rounded-xl bg-pot-600 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {loadingBalance ? "Asking the TEE." : "Refresh balance"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pot total</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
          {potBalance !== null ? ethers.formatUnits(potBalance, TOKEN_DECIMALS) : "…"}
          <span className="ml-2 text-sm font-medium text-slate-400">FXRP</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">What everyone's contributed together, publicly visible on chain.</p>
      </section>

      <p className="text-center text-xs text-slate-400">Use the tiles above to deposit, send, or invite people.</p>
    </>
  );
}
