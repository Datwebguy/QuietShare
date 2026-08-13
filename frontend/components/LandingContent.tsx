"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";

const STEPS = [
  {
    number: "01",
    title: "Create a pot",
    body: "Name it and invite your people by link."
  },
  {
    number: "02",
    title: "Everyone puts money in",
    body: "The app only shows each person their own share. Deposit amounts are still visible on chain, like any token transfer."
  },
  {
    number: "03",
    title: "Spend together",
    body: "Propose and approve spends. Everything stays between the group."
  }
];

const REASONS = [
  {
    title: "Private by default",
    body: "Powered by Flare Confidential Compute. Per-member share is not stored in a public contract mapping."
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

export function LandingContent() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    function handlePointerMove(e: PointerEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = heroRef.current;
        if (!el) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.transform = `perspective(1200px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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

      <section
        ref={heroRef}
        className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center transition-transform duration-200 ease-out [transform-style:preserve-3d]"
      >
        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-pot-200 motion-safe:animate-[spin-slow_20s_linear_infinite]" />
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-pot-gradient shadow-glow">
            <Logo className="h-7 w-7 text-white" />
          </span>
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Private group money pots
          <br />
          <span className="bg-pot-gradient bg-clip-text text-transparent">for roommates, families and friends</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 sm:text-xl">
          The pot is shared. Your remaining share is not listed on the contract.
          <br />
          Deposit amounts stay visible on chain, like any ERC20 transfer.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/home"
            className="inline-flex items-center justify-center rounded-xl bg-pot-gradient px-8 py-4 text-base font-semibold text-white shadow-glow transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Create a private pot →
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          Login with Google or Apple · Works on your phone · Zero crypto knowledge needed
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-12 text-center text-2xl font-semibold text-ink">How it works</h2>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-card backdrop-blur transition hover:-translate-y-1"
            >
              <div className="mb-3 text-sm font-semibold text-pot-600">{step.number}</div>
              <h3 className="mb-2 text-lg font-medium text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-12 text-center text-2xl font-semibold text-ink">Why QuietShare</h2>
        <div className="grid gap-6 text-center sm:grid-cols-3">
          {REASONS.map((reason) => (
            <div key={reason.title}>
              <h3 className="mb-2 font-medium text-ink">{reason.title}</h3>
              <p className="text-sm text-slate-500">{reason.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="mb-6 text-3xl font-semibold text-ink">Ready to start a group pot?</h2>
        <Link
          href="/home"
          className="inline-flex items-center justify-center rounded-xl bg-pot-gradient px-8 py-4 text-base font-semibold text-white shadow-glow transition hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Create your first pot →
        </Link>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        <p>QuietShare · Private group money on Flare</p>
      </footer>
    </div>
  );
}
