"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/lib/useWallet";
import { getVaultContract, potIdFromName } from "@/lib/contracts";
import { CONTRACTS, COSTON2_FAUCET_URL } from "@/lib/chain";
import { getKnownPots, rememberPot, type KnownPot } from "@/lib/localPots";
import { getUsernameRegistryContract } from "@/lib/contracts";
import { setMyUsername } from "@/lib/useUsernames";
import { Logo } from "@/components/Logo";
import { friendlyError } from "@/lib/friendlyError";

// Below this, a create/join/spend tx is likely to fail on gas, shown as a
// heads-up before someone hits the on-chain "insufficient funds" error blind,
// not a hard cutoff (actual gas needed varies by tx).
const LOW_GAS_THRESHOLD = ethers.parseEther("0.05");

export function AppHomeContent() {
  const { connect, disconnect, connecting, initializing, isConnected, address, signer } = useWallet();
  const router = useRouter();

  const [pots, setPots] = useState<KnownPot[]>([]);
  const [potName, setPotName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gasBalance, setGasBalance] = useState<bigint | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setPots(getKnownPots(address));
  }, [address]);

  useEffect(() => {
    setGasBalance(null);
    if (!signer?.provider || !address) return;
    let cancelled = false;
    signer.provider.getBalance(address).then((bal) => {
      if (!cancelled) setGasBalance(bal);
    });
    return () => {
      cancelled = true;
    };
  }, [signer, address]);

  useEffect(() => {
    setMyName("");
    if (!signer || !address) return;
    let cancelled = false;
    (async () => {
      try {
        const registry = getUsernameRegistryContract(signer);
        const name: string = await registry.nameOf(address);
        if (!cancelled) {
          setMyName(name);
          setNameInput(name);
        }
      } catch (e) {
        console.error("fetching display name failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signer, address]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1500);
  }

  async function saveName() {
    if (!signer) return;
    setError(null);
    setSavingName(true);
    try {
      const trimmed = nameInput.trim();
      await setMyUsername(signer, trimmed);
      setMyName(trimmed);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1500);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSavingName(false);
    }
  }

  async function createPot() {
    if (!signer || !address || !potName.trim()) return;
    setError(null);
    setBusy("Creating your pot on Coston2…");
    try {
      const potId = potIdFromName(potName);
      const vault = getVaultContract(signer);
      const tx = await vault.createPot(potId, CONTRACTS.token);
      await tx.wait();
      rememberPot(address, { potId, name: potName.trim() });
      router.push(`/pot/${potId}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function joinPot() {
    if (!signer || !address || !joinId.trim()) return;
    setError(null);
    // Accept either a bare pot ID or the full invite URL (the "Invite" card on
    // the pot page shares the full link, so that's what people usually paste).
    // A typed NAME is deliberately not accepted: potIdFromName() is
    // deterministic (same name -> same id for anyone), so treating a plain
    // name as an invite would let anyone join any pot just by guessing a
    // common name like "Rent". The invite link/ID is the only actual access
    // control this app has, and this input must not accept anything weaker.
    const pasted = joinId.trim();
    const potId = pasted.includes("/pot/") ? pasted.slice(pasted.lastIndexOf("/pot/") + "/pot/".length) : pasted;
    if (!ethers.isHexString(potId, 32)) {
      setError("That doesn't look like a pot invite. Paste the full link (or ID) from your invite.");
      return;
    }
    setBusy("Joining pot…");
    try {
      const vault = getVaultContract(signer);
      const alreadyMember: boolean = await vault.isMember(potId, address);
      if (!alreadyMember) {
        const tx = await vault.joinPot(potId);
        await tx.wait();
      }
      rememberPot(address, { potId, name: `Pot ${potId.slice(0, 8)}…` });
      router.push(`/pot/${potId}`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  if (initializing) {
    // Deliberately not the login screen: address starts out null the same
    // way whether we haven't checked for a session yet or genuinely checked
    // and found none, so rendering the login screen here would mean every
    // refresh of an already-logged-in session flashes "Continue with Google"
    // for a moment before flipping to the real dashboard. This neutral state
    // shows until we actually know which one it is.
    return (
      <main className="flex min-h-[85vh] flex-col items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-pot-gradient shadow-glow">
          <Logo className="h-8 w-8 animate-pulse text-white" />
        </div>
      </main>
    );
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-[85vh] flex-col items-center justify-center gap-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-pot-gradient shadow-glow">
          <Logo className="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-ink">QuietShare</h1>
          <p className="mx-auto mt-3 max-w-xs text-slate-600">
            A group money pot. The contract stores the pot total, not each member's share.
          </p>
        </div>
        <button
          onClick={() => connect()}
          disabled={connecting}
          className="w-full max-w-xs rounded-2xl bg-pot-gradient px-6 py-4 font-semibold text-white shadow-glow transition active:scale-[0.98] disabled:opacity-60"
        >
          {connecting ? "Connecting…" : "Continue with Google or Apple"}
        </button>
        <p className="text-xs text-slate-400">No seed phrase. No crypto knowledge needed.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pot-gradient shadow-glow">
            <Logo className="h-5 w-5 text-white" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-ink">QuietShare</h1>
        </div>
        <button
          onClick={() => disconnect()}
          title="Log out"
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition active:scale-95"
        >
          {myName || `${address?.slice(0, 6)}…${address?.slice(-4)}`}
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
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="font-semibold">Your wallet</h2>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 py-2 pl-3 pr-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600" title={address ?? ""}>
            {address}
          </span>
          <button
            onClick={copyAddress}
            aria-label="Copy wallet address"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition active:scale-95"
          >
            {addressCopied ? (
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

        <div className="mt-3 flex gap-2">
          <input
            autoComplete="off"
            maxLength={32}
            placeholder="Display name (optional)"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button
            onClick={saveName}
            disabled={savingName || nameInput.trim() === myName}
            className="shrink-0 rounded-xl bg-pot-600 px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {savingName ? "Saving…" : nameSaved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Shown to other pot members instead of your address. Visible to anyone, not a secret, just a label.
        </p>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Gas balance</span>
          <span className="font-medium tabular-nums text-ink">
            {gasBalance === null ? "…" : `${ethers.formatEther(gasBalance)} C2FLR`}
          </span>
        </div>

        {gasBalance !== null && gasBalance < LOW_GAS_THRESHOLD && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            You're low on C2FLR, the gas token pots and payments run on. Copy your address above and get some free at
            the{" "}
            <a href={COSTON2_FAUCET_URL} target="_blank" rel="noreferrer" className="font-semibold underline">
              Coston2 faucet
            </a>{" "}
            before creating or joining a pot.
          </p>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="font-semibold">Start a pot</h2>
        <input
          autoComplete="off"
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
          placeholder="e.g. Roommates rent"
          value={potName}
          onChange={(e) => setPotName(e.target.value)}
        />
        <button
          onClick={createPot}
          disabled={!!busy || !potName.trim()}
          className="mt-3 w-full rounded-xl bg-pot-600 px-4 py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          Create pot
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="font-semibold">Join a pot</h2>
        <input
          autoComplete="off"
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-pot-500 focus:outline-none focus:ring-2 focus:ring-pot-100"
          placeholder="Paste the invite link or pot ID"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
        />
        <button
          onClick={joinPot}
          disabled={!!busy || !joinId.trim()}
          className="mt-3 w-full rounded-xl border border-pot-600 px-4 py-2.5 font-semibold text-pot-700 transition active:scale-[0.98] disabled:opacity-50"
        >
          Join pot
        </button>
      </section>

      {busy && <p className="text-sm text-slate-500">{busy}</p>}

      {pots.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Your pots</h2>
          <ul className="flex flex-col gap-2">
            {pots.map((p) => (
              <li key={p.potId}>
                <a
                  href={`/pot/${p.potId}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pot-gradient">
                    <Logo className="h-5 w-5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.potId}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
