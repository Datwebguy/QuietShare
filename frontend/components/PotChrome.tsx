"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { usePotContext } from "@/components/PotProvider";

const TABS = [
  { href: "", label: "Overview", icon: HomeIcon },
  { href: "/deposit", label: "Deposit", icon: DepositIcon },
  { href: "/send", label: "Send", icon: SendIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/members", label: "Members", icon: MembersIcon },
  { href: "/invite", label: "Invite", icon: InviteIcon }
];

export function PotChrome({ children }: { children: React.ReactNode }) {
  const { potId, address, connect, connecting, disconnect, joining, isMember, membersLoaded, joinThisPot, initializing } =
    usePotContext();
  const pathname = usePathname();
  const base = `/pot/${potId}`;

  if (initializing) {
    // Same reasoning as AppHomeContent's initializing guard: address starts
    // null whether or not a session is about to be restored, so rendering
    // the tiles/banners here would flash "log in" before flipping to the
    // real chrome on every refresh of an already-logged-in session.
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pot-gradient shadow-glow">
          <Logo className="h-6 w-6 animate-pulse text-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <Link href="/home" className="text-sm text-slate-500">
          ← My pots
        </Link>
        {address ? (
          <button
            onClick={() => disconnect()}
            title="Log out"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition active:scale-95"
          >
            {address.slice(0, 6)}…{address.slice(-4)}
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => connect()}
            disabled={connecting}
            className="rounded-full bg-pot-gradient px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Log in"}
          </button>
        )}
      </header>

      {/* A friend arriving via a shared invite link/QR code has neither logged
          in nor joined yet. Without these, every screen below would just
          look empty with no indication why, or no way to fix it. */}
      {!address && (
        <section className="rounded-2xl border border-pot-200 bg-pot-50 p-4 text-center">
          <p className="text-sm text-ink">Log in to view and join this pot.</p>
          <button
            onClick={() => connect()}
            disabled={connecting}
            className="mt-3 w-full rounded-xl bg-pot-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Continue with Google or Apple"}
          </button>
        </section>
      )}
      {address && membersLoaded && !isMember && (
        <section className="rounded-2xl border border-pot-200 bg-pot-50 p-4 text-center">
          <p className="text-sm text-ink">You're not a member of this pot yet.</p>
          <p className="mt-1 text-xs text-slate-500">Join to deposit, propose, or approve payments.</p>
          <button
            onClick={joinThisPot}
            disabled={joining}
            className="mt-3 w-full rounded-xl bg-pot-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition active:scale-[0.98] disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join this pot"}
          </button>
        </section>
      )}

      {/* Quick-action tiles, bank-app style: tap into one focused screen at a
          time instead of scrolling through everything stacked on one page. */}
      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = pathname === href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-95 ${
                active ? "border-pot-600 bg-pot-50 text-pot-700" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}
    </main>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return <Logo className={className} />;
}

function DepositIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 12h4l3 8 4-16 3 8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MembersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M15 20c0-2.5 1-4.5 3-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" fill="currentColor" />
    </svg>
  );
}
