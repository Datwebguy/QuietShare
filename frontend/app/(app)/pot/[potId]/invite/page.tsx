"use client";

import { useState } from "react";
import { usePotContext } from "@/components/PotProvider";
import { useQrCode } from "@/lib/useQrCode";

export default function InvitePage() {
  const { inviteUrl } = usePotContext();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrDataUrl = useQrCode(inviteUrl);

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="rounded-3xl bg-pot-gradient p-6 text-white shadow-glow">
      <h2 className="font-semibold">Invite</h2>
      <p className="mt-1 text-xs text-pot-100">Share this link or QR code. Anyone with it can join this pot.</p>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/15 py-2 pl-3 pr-2 backdrop-blur">
        <span className="min-w-0 flex-1 truncate text-left text-xs">{inviteUrl}</span>
        <button
          onClick={() => setShowQr((v) => !v)}
          aria-label="Show QR code"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition active:scale-95 ${
            showQr ? "bg-white text-pot-700" : "bg-white/20"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            <path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={copyInvite}
          aria-label="Copy invite link"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 transition active:scale-95"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {showQr && qrDataUrl && (
        <div className="mt-4 flex justify-center">
          <div className="rounded-2xl bg-white p-3 shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Pot invite QR code" width={160} height={160} />
          </div>
        </div>
      )}
    </section>
  );
}
