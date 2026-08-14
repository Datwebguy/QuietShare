"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";

const STEPS = [
  {
    number: "01",
    title: "Create a pot",
    body: "Name it and invite your people by link. No seed phrase, no wallet extension."
  },
  {
    number: "02",
    title: "Everyone puts money in",
    body: "Deposits are a normal, public transfer. What each person still holds is not."
  },
  {
    number: "03",
    title: "Spend together",
    body: "Propose a payment. It only goes out once the group votes yes."
  }
];

const REASONS = [
  {
    title: "Private by default",
    body: "Powered by Flare Confidential Compute. Per-member share is never written to a public contract mapping."
  },
  {
    title: "Built for normal people",
    body: "Social login. No seed phrases. No complicated wallets."
  },
  {
    title: "Works on any phone",
    body: "Fast, clean, and mobile friendly from the start."
  }
];

const PUBLIC_ROWS = ["A pot exists", "Who is in it", "That a deposit or payout happened, and its amount"];
const PRIVATE_ROWS = ["Your remaining share of the pot", "Computed inside a TEE, not a contract", "Shown only to you, on request"];

function FloatingBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-white">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-pot-gradient opacity-20 blur-3xl will-change-transform motion-safe:animate-[float-a_18s_ease-in-out_infinite]" />
      <div className="absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-pot-500 opacity-10 blur-3xl will-change-transform motion-safe:animate-[float-b_22s_ease-in-out_infinite]" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-pot-700 opacity-10 blur-3xl will-change-transform motion-safe:animate-[float-c_16s_ease-in-out_infinite]" />
      <div className="absolute -bottom-24 right-1/3 h-72 w-72 rounded-full bg-pot-200 opacity-30 blur-3xl will-change-transform motion-safe:animate-[float-a_26s_ease-in-out_infinite_reverse]" />
    </div>
  );
}

/** A small, honest recreation of the app's own Overview screen. Not a
 *  generic hero illustration, this shows the actual private-balance /
 *  public-total split a visitor will see the moment they open the app. */
function BalanceMockup() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    function handlePointerMove(e: PointerEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = cardRef.current;
        if (!el) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.transform = `perspective(1200px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) rotate(-2deg)`;
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-sm md:mx-0">
      <div className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2.5rem] bg-pot-gradient opacity-90 blur-2xl" aria-hidden />
      <div
        ref={cardRef}
        className="relative rounded-[1.75rem] border border-slate-100 bg-white p-6 shadow-glow transition-transform duration-200 ease-out [transform-style:preserve-3d]"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pot-gradient">
            <Logo className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-sm font-semibold">Ski trip 2026</span>
        </div>

        <div className="mt-5 rounded-2xl bg-pot-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-pot-700">Your private balance</p>
          <p className="mt-1.5 text-3xl font-bold tabular-nums text-ink">
            12.5<span className="ml-1.5 text-base font-medium text-slate-400">FXRP</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500">Only shown to you. Not stored on the contract.</p>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-100 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pot total</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">40.0 FXRP</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Public</span>
        </div>

        <div className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-pot-700 shadow-glow">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="white" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="white" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LandingContent() {
  return (
    <div className="relative min-h-screen text-ink">
      <FloatingBackground />

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pot-gradient shadow-glow">
            <Logo className="h-4 w-4 text-white" />
          </span>
          <span className="text-xl font-semibold tracking-tight">QuietShare</span>
        </div>
        <Link href="/home" className="text-sm text-slate-500 transition hover:text-pot-700">
          Open app
        </Link>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-24 pt-12 md:grid-cols-[1.05fr_0.95fr] md:items-center md:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-pot-200 bg-pot-50 px-3.5 py-1.5 text-xs font-semibold text-pot-700">
            <span className="h-1.5 w-1.5 rounded-full bg-pot-600" />
            Built on Flare Confidential Compute
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            The pot is shared.
            <br />
            <span className="bg-pot-gradient bg-clip-text text-transparent">Your share isn&rsquo;t.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-slate-500">
            A private group money pot for roommates, families and friends. Deposits stay public, like any transfer.
            What&rsquo;s left in your name is computed inside a TEE and shown only to you.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/home"
              className="inline-flex items-center justify-center rounded-xl bg-pot-gradient px-7 py-3.5 text-base font-semibold text-white shadow-glow transition hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Create a private pot →
            </Link>
          </div>

          <p className="mt-5 text-sm text-slate-400">Login with Google or Apple · Works on your phone · Zero crypto knowledge needed</p>
        </div>

        <BalanceMockup />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-ink">How it works</h2>

        <div className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-slate-200 md:block" aria-hidden />
          {STEPS.map((step) => (
            <div key={step.number} className="relative">
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-pot-gradient text-sm font-bold text-white shadow-glow">
                {step.number}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-ink">What&rsquo;s public, what isn&rsquo;t</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          QuietShare doesn&rsquo;t hide that a pot exists or that money moved. It hides one specific thing: how much of
          the pot is currently yours.
        </p>

        <div className="mt-10 grid overflow-hidden rounded-2xl border border-slate-200 shadow-card md:grid-cols-2">
          <div className="bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">On chain, for anyone</p>
            <ul className="mt-5 flex flex-col gap-4">
              {PUBLIC_ROWS.map((row) => (
                <li key={row} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                    ✓
                  </span>
                  {row}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-pot-dark p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-pot-200">Inside the TEE, for you only</p>
            <ul className="mt-5 flex flex-col gap-4">
              {PRIVATE_ROWS.map((row) => (
                <li key={row} className="flex items-start gap-3 text-sm text-pot-50">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-pot-200">
                    ✓
                  </span>
                  {row}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Why QuietShare</h2>
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Three things it gets right that a spreadsheet, or most wallets, don&rsquo;t.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {REASONS.map((reason) => (
              <div key={reason.title}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-pot-100 text-pot-700">
                  <span className="h-2 w-2 rounded-full bg-pot-600" />
                </div>
                <h3 className="font-medium text-ink">{reason.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-8 pt-4">
        <div className="rounded-[2rem] bg-pot-dark px-8 py-16 text-center shadow-glow">
          <h2 className="text-3xl font-semibold text-white">Ready to start a group pot?</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-pot-100">
            Takes about a minute. No wallet setup, no seed phrase to lose.
          </p>
          <Link
            href="/home"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-pot-800 shadow-glow transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Create your first pot →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pot-gradient">
                  <Logo className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-lg font-semibold tracking-tight text-ink">QuietShare</span>
              </div>
              <p className="mt-2 max-w-xs text-sm text-slate-500">Private group money, built on Flare.</p>
            </div>

            <div className="flex gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product</p>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  <li>
                    <Link href="/home" className="text-slate-500 transition hover:text-pot-700">
                      Open app
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Code</p>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  <li>
                    <a
                      href="https://github.com/Datwebguy/QuietShare"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-pot-700"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.35.95.1-.75.4-1.25.73-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.48.11-3.09 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.61.24 2.8.12 3.09.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.39-5.26 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.21.66.8.55A10.51 10.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
                      </svg>
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 QuietShare</p>
            <p>Built for the Flare Summer Signal hackathon, Confidential Compute track</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
