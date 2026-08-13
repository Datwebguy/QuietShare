"use client";

import { ethers } from "ethers";
import { usePotContext } from "@/components/PotProvider";
import { TOKEN_DECIMALS } from "@/lib/usePot";
import { COSTON2_FAUCET_URL } from "@/lib/chain";

export default function DepositPage() {
  const { amount, setAmount, depositAmountValid, deposit, walletBalance, loadingWalletBalance, refreshWalletBalance, error, status } =
    usePotContext();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Deposit</h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Wallet: {walletBalance === null ? "…" : ethers.formatUnits(walletBalance, TOKEN_DECIMALS)} FXRP</span>
          <button
            onClick={refreshWalletBalance}
            disabled={loadingWalletBalance}
            aria-label="Refresh wallet balance"
            title="Refresh wallet balance"
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:text-pot-600 active:scale-90 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`h-3.5 w-3.5 ${loadingWalletBalance ? "animate-spin" : ""}`}>
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
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {status && <p className="mt-3 text-sm text-slate-500">{status}</p>}

      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount in FXRP"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          onClick={deposit}
          disabled={!depositAmountValid}
          className="rounded-xl bg-pot-600 px-5 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
        <a href={COSTON2_FAUCET_URL} target="_blank" rel="noreferrer" className="underline">
          Need test FXRP or C2FLR gas? Coston2 faucet
        </a>
      </div>
    </section>
  );
}
