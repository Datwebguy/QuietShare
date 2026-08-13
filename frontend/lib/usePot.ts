"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useWallet } from "@/lib/useWallet";
import { getInstructionSenderContract, getTokenContract, getVaultContract } from "@/lib/contracts";
import { LOCAL_DEMO_MODE } from "@/lib/chain";
import { encryptDepositNote } from "@/lib/tee-crypto";
import { pollActionResult } from "@/lib/fce";
import { getBalanceLocalDemo, recordDepositLocalDemo, recordSpendLocalDemo } from "@/lib/localDemo";
import { fetchVaultEvents } from "@/lib/explorerLogs";
import { rememberPot } from "@/lib/localPots";
import { friendlyError } from "@/lib/friendlyError";

export const TOKEN_DECIMALS = 6;

// The TeeExtensionRegistry charges a per-instruction fee (docs/instruction-sender.md).
// 1000000 wei is what fce-extension/tools hardcodes for testnet, verify against your
// deployed registry (OperationFeesFacet) before relying on it. Unused in LOCAL_DEMO_MODE.
const INSTRUCTION_FEE_WEI = BigInt(process.env.NEXT_PUBLIC_INSTRUCTION_FEE_WEI ?? "1000000");

export interface BalanceResult {
  potId: string;
  member: string;
  balance: string;
  totalDeposited: string;
}

export interface SpendProposal {
  proposalId: string;
  to: string;
  amount: bigint;
  memo: string;
  proposer: string;
  approvalCount: number;
  executed: boolean;
  approvedByMe: boolean;
  executedTxHash?: string;
  executedBlockNumber?: number;
}

export interface ActivityItem {
  type: "deposit" | "payout";
  amount: bigint;
  who: string;
  blockNumber: number;
  txHash: string;
}

export function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function mergeProposals(prev: SpendProposal[], fromExplorer: SpendProposal[]): SpendProposal[] {
  const byId = new Map(fromExplorer.map((p) => [p.proposalId.toLowerCase(), p]));
  const extras = prev.filter((p) => !byId.has(p.proposalId.toLowerCase()));
  const mergedExplorer = fromExplorer.map((p) => {
    const local = prev.find((x) => x.proposalId.toLowerCase() === p.proposalId.toLowerCase());
    if (!local) return p;
    return {
      ...p,
      executed: p.executed || local.executed,
      approvedByMe: p.approvedByMe || local.approvedByMe,
      approvalCount: Math.max(p.approvalCount, local.approvalCount),
      executedTxHash: p.executedTxHash ?? local.executedTxHash,
      executedBlockNumber: p.executedBlockNumber ?? local.executedBlockNumber
    };
  });
  return [...extras, ...mergedExplorer];
}

function mergeActivity(prev: ActivityItem[], fresh: ActivityItem[]): ActivityItem[] {
  const hashes = new Set(fresh.map((a) => a.txHash.toLowerCase()));
  const extras = prev.filter((a) => !hashes.has(a.txHash.toLowerCase()));
  return [...extras, ...fresh].sort((a, b) => b.blockNumber - a.blockNumber);
}

/** All state and actions for a single pot, shared across the overview and
 *  every drill-down screen (deposit/send/activity/members/invite) via
 *  PotProvider — one fetch/mutation surface instead of each screen
 *  duplicating contract wiring. */
export function usePot(potId: string) {
  const { signer, address, connect, connecting, disconnect, initializing } = useWallet();
  const router = useRouter();

  const [members, setMembers] = useState<string[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [joining, setJoining] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceResult | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  const [spendTo, setSpendTo] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendMemo, setSpendMemo] = useState("");
  const [proposals, setProposals] = useState<SpendProposal[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [potBalance, setPotBalance] = useState<bigint | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [loadingWalletBalance, setLoadingWalletBalance] = useState(false);
  const [refreshingProposals, setRefreshingProposals] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [refreshingActivity, setRefreshingActivity] = useState(false);

  const depositAmountValid = amount.trim() !== "" && !isNaN(Number(amount)) && Number(amount) > 0;
  const spendToValid = spendTo.trim() !== "" && ethers.isAddress(spendTo.trim());
  const spendAmountValid = spendAmount.trim() !== "" && !isNaN(Number(spendAmount)) && Number(spendAmount) > 0;
  const spendAmountBaseUnits = spendAmountValid ? ethers.parseUnits(spendAmount, TOKEN_DECIMALS) : null;
  const spendExceedsPotBalance =
    spendAmountBaseUnits !== null && potBalance !== null && spendAmountBaseUnits > potBalance;
  const canPropose = spendToValid && spendAmountValid && !spendExceedsPotBalance;

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/pot/${potId}`);
  }, [potId]);

  // The on-chain action (deposit/propose/approve) is already confirmed by the
  // time these run — a failure here is just the follow-up list refresh, not
  // the action itself, so it's logged rather than surfaced as a red error
  // that would wrongly read as "your deposit/proposal/approval failed."
  // The list catches up on the next natural refresh either way.
  async function safeRefresh(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      console.error(`${label} refresh failed:`, e);
    }
  }

  async function refreshMembers() {
    if (!signer) return;
    const vault = getVaultContract(signer);
    setMembers(await vault.members(potId));
    setMembersLoaded(true);
  }

  const isMember = !!address && members.some((m) => m.toLowerCase() === address.toLowerCase());

  // Covers every path to membership, not just the "Join this pot" button
  // below: the creator opening this link on a browser that never ran
  // createPot() locally (a new device, cleared storage) is just as
  // membership-confirmed as someone who just joined, and belongs in "Your
  // pots" too. rememberPot() already dedupes by potId, so this is harmless
  // to re-run on every visit.
  useEffect(() => {
    if (address && isMember) {
      rememberPot(address, { potId, name: `Pot ${potId.slice(0, 8)}…` });
    }
  }, [address, isMember, potId]);

  // Joining currently only lived on the dashboard's "Join a pot" field, which
  // meant anyone who opened an invite link or scanned the QR code directly —
  // the actual intended way to invite someone — had no way to become a
  // member (and therefore no way to deposit or approve) without first
  // navigating away, pasting the ID into the dashboard, then coming back.
  async function joinThisPot() {
    if (!signer || !address) return;
    setError(null);
    setJoining(true);
    try {
      const vault = getVaultContract(signer);
      const tx = await vault.joinPot(potId);
      await tx.wait();
      rememberPot(address, { potId, name: `Pot ${potId.slice(0, 8)}…` });
      await safeRefresh("members", refreshMembers);
    } catch (e) {
      console.error("joinThisPot failed:", e);
      setError(friendlyError(e));
    } finally {
      setJoining(false);
    }
  }

  async function refreshPotBalance() {
    if (!signer) return;
    const vault = getVaultContract(signer);
    setPotBalance(await vault.potBalance(potId));
  }

  // Distinct from "Your private balance": this is what's sitting in the
  // connected wallet, not yet deposited into this pot — e.g. right after
  // claiming from the faucet. It's a plain ERC20 balanceOf, not a TEE read,
  // so it has its own refresh rather than reusing the balance card's.
  async function refreshWalletBalance() {
    if (!signer || !address) return;
    setLoadingWalletBalance(true);
    try {
      const token = getTokenContract(signer);
      setWalletBalance(await token.balanceOf(address));
    } finally {
      setLoadingWalletBalance(false);
    }
  }

  async function refreshProposals() {
    if (!signer) return;
    const vault = getVaultContract(signer);

    const proposedEvents = await fetchVaultEvents(vault, "SpendProposed", potId);
    const list: SpendProposal[] = [];

    for (const ev of proposedEvents) {
      const { proposalId, proposer, to, amount, memo } = ev.args as unknown as {
        proposalId: string;
        proposer: string;
        to: string;
        amount: bigint;
        memo: string;
      };

      const approvedEvents = await fetchVaultEvents(vault, "SpendApproved", proposalId);
      let approvalCount = 0;
      let approvedByMe = false;
      for (const ae of approvedEvents) {
        const { approver, approvalCount: count } = ae.args as unknown as { approver: string; approvalCount: bigint };
        approvalCount = Number(count);
        if (address && approver.toLowerCase() === address.toLowerCase()) approvedByMe = true;
      }

      const executedEvents = await fetchVaultEvents(vault, "SpendExecuted", proposalId);
      const executedEvent = executedEvents[0];

      list.push({
        proposalId,
        to,
        amount,
        memo,
        proposer,
        approvalCount,
        approvedByMe,
        executed: !!executedEvent,
        executedTxHash: executedEvent?.transactionHash,
        executedBlockNumber: executedEvent?.blockNumber
      });
    }

    const fromExplorer = list.reverse();
    let merged: SpendProposal[] = fromExplorer;
    setProposals((prev) => {
      merged = mergeProposals(prev, fromExplorer);
      return merged;
    });
    return merged;
  }

  async function refreshActivity(currentProposals?: SpendProposal[]) {
    if (!signer) return;
    const vault = getVaultContract(signer);

    // Deposit amounts are public on-chain (a normal ERC20 transfer), so
    // showing them here is consistent with the privacy model, not a leak.
    const depositEvents = await fetchVaultEvents(vault, "Deposited", potId);
    const deposits: ActivityItem[] = depositEvents.map((ev) => ({
      type: "deposit",
      amount: ev.args.amount as bigint,
      who: ev.args.depositor as string,
      blockNumber: ev.blockNumber,
      txHash: ev.transactionHash
    }));

    const payouts: ActivityItem[] = (currentProposals ?? proposals)
      .filter((p) => p.executed && p.executedTxHash && p.executedBlockNumber !== undefined)
      .map((p) => ({
        type: "payout",
        amount: p.amount,
        who: p.to,
        blockNumber: p.executedBlockNumber!,
        txHash: p.executedTxHash!
      }));

    const fresh = [...deposits, ...payouts].sort((a, b) => b.blockNumber - a.blockNumber);
    setActivity((prev) => mergeActivity(prev, fresh));
  }

  useEffect(() => {
    // Every field here must be cleared synchronously, not just refetched —
    // the refetches below are async, and until they resolve, whatever was
    // left over from the PREVIOUSLY viewed pot (or account) would otherwise
    // still be sitting in state. Navigating from a pot you're in to one you
    // aren't, or switching accounts, would briefly — or indefinitely, if a
    // refetch fails — show the wrong pot's members, balance, proposals, and
    // activity. Same reasoning as the balance-across-account-switch fix,
    // just missed for the rest of this pot's state at the time.
    setBalance(null);
    setMembers([]);
    setMembersLoaded(false);
    setPotBalance(null);
    setWalletBalance(null);
    setProposals([]);
    setActivity([]);
    setAmount("");
    setSpendTo("");
    setSpendAmount("");
    setSpendMemo("");
    setError(null);
    setStatus(null);
    (async () => {
      await safeRefresh("members", refreshMembers);
      await safeRefresh("pot balance", refreshPotBalance);
      await safeRefresh("wallet balance", refreshWalletBalance);
      await safeRefresh("proposals and activity", async () => {
        const list = await refreshProposals();
        await refreshActivity(list);
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, potId]);

  async function refreshBalance() {
    if (!signer || !address) return;
    setError(null);
    setLoadingBalance(true);
    try {
      if (LOCAL_DEMO_MODE) {
        const result = await getBalanceLocalDemo(potId, address, signer);
        setBalance(result);
        return;
      }

      const instructionSender = getInstructionSenderContract(signer);
      const tx = await instructionSender.sendGetBalance(potId, { value: INSTRUCTION_FEE_WEI });
      const receipt = await tx.wait();

      // Our contract's sendGetBalance() declares `returns (bytes32 instructionId)`.
      // A mined tx doesn't surface that return value directly in ethers, so we
      // predict it with a read-only staticCall against the same block state.
      // This assumes the registry derives instructionId deterministically from
      // the call inputs; verify against your deployed registry. If it isn't
      // deterministic, read the TeeInstructionsSent event from receipt.logs
      // instead (see fce-extension/tools/pkg/utils/instructions.go).
      const instructionId: string = await instructionSender.sendGetBalance.staticCall(potId, {
        value: INSTRUCTION_FEE_WEI
      });

      const result = await pollActionResult<BalanceResult>(instructionId);
      setBalance(result);
      void receipt;
    } catch (e) {
      console.error("refreshBalance failed:", e);
      setError(friendlyError(e));
    } finally {
      setLoadingBalance(false);
    }
  }

  async function deposit() {
    if (!signer || !depositAmountValid) return;
    setError(null);
    try {
      const amountBaseUnits = ethers.parseUnits(amount, TOKEN_DECIMALS);
      const token = getTokenContract(signer);
      const vault = getVaultContract(signer);

      setStatus("Approving FXRP spend.");
      const allowance: bigint = await token.allowance(address, await vault.getAddress());
      if (allowance < amountBaseUnits) {
        const approveTx = await token.approve(await vault.getAddress(), ethers.MaxUint256);
        await approveTx.wait();
      }

      // Move the real value: this transfer amount is visible on chain, like any
      // ERC20 transfer. What stays private is what happens next.
      setStatus("Depositing into the pot.");
      const encryptedNote = await encryptDepositNote({ potId, amount: amountBaseUnits.toString() });
      const depositTx = await vault.deposit(potId, amountBaseUnits, encryptedNote);
      const depositReceipt = await depositTx.wait();

      // The block explorer that refreshActivity() reads from indexes a few
      // seconds behind the chain — reading this deposit straight off its own
      // transaction receipt instead means it shows up immediately, not only
      // once the explorer catches up (which was making a deposit you just
      // made look like it never happened).
      for (const log of depositReceipt?.logs ?? []) {
        try {
          const parsed = vault.interface.parseLog(log);
          if (parsed?.name === "Deposited") {
            const item: ActivityItem = {
              type: "deposit",
              amount: parsed.args.amount as bigint,
              who: parsed.args.depositor as string,
              blockNumber: depositReceipt!.blockNumber,
              txHash: depositReceipt!.hash
            };
            setActivity((prev) => [item, ...prev.filter((a) => a.txHash !== item.txHash)]);
          }
        } catch {
          // Not every log in the receipt is one of PotVault's own events (e.g. ERC20 Transfer) — skip those.
        }
      }

      // Tell the TEE about it, so it can update the private per-member ledger
      // PotVault never stores. LOCAL_DEMO_MODE calls the same handler code
      // directly over HTTP instead of via the onchain instruction relay.
      setStatus("Recording your private balance.");
      if (LOCAL_DEMO_MODE) {
        await recordDepositLocalDemo(potId, address!, encryptedNote, signer);
      } else {
        const instructionSender = getInstructionSenderContract(signer);
        const recordTx = await instructionSender.sendRecordDeposit(potId, encryptedNote, {
          value: INSTRUCTION_FEE_WEI
        });
        await recordTx.wait();
      }

      setAmount("");
      setStatus("Deposited. Updating your private balance…");
      await safeRefresh("balance", refreshBalance);
      await safeRefresh("pot balance", refreshPotBalance);
      await safeRefresh("wallet balance", refreshWalletBalance);
      await safeRefresh("activity", refreshActivity);
      setStatus("Deposited. Your private balance is updated.");
    } catch (e) {
      console.error("deposit failed:", e);
      setError(friendlyError(e));
    } finally {
      setTimeout(() => setStatus(null), 4000);
    }
  }

  async function proposeSpend() {
    if (!signer || !canPropose || spendAmountBaseUnits === null) return;
    setError(null);
    setStatus("Proposing spend.");
    try {
      const vault = getVaultContract(signer);
      const tx = await vault.proposeSpend(potId, spendTo, spendAmountBaseUnits, spendMemo);
      const receipt = await tx.wait();
      setSpendTo("");
      setSpendAmount("");
      setSpendMemo("");

      // Same reasoning as the deposit fix above: decode this proposal off its
      // own receipt so it appears immediately, rather than only once the
      // explorer-backed refreshProposals() below catches up.
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = vault.interface.parseLog(log);
          if (parsed?.name === "SpendProposed") {
            const newProposal: SpendProposal = {
              proposalId: parsed.args.proposalId as string,
              to: parsed.args.to as string,
              amount: parsed.args.amount as bigint,
              memo: parsed.args.memo as string,
              proposer: parsed.args.proposer as string,
              approvalCount: 0,
              executed: false,
              approvedByMe: false
            };
            setProposals((prev) => [newProposal, ...prev.filter((p) => p.proposalId !== newProposal.proposalId)]);
          }
        } catch {
          // Not every log in the receipt is one of PotVault's own events — skip those.
        }
      }

      await safeRefresh("proposals", refreshProposals);
      setStatus("Proposal sent. Other members need to approve it.");
    } catch (e) {
      console.error("proposeSpend failed:", e);
      setError(friendlyError(e));
    } finally {
      setTimeout(() => setStatus(null), 4000);
    }
  }

  async function approveSpend(proposalId: string) {
    if (!signer) return;
    setError(null);
    setStatus("Approving.");
    try {
      const vault = getVaultContract(signer);
      const tx = await vault.approveSpend(proposalId);
      const receipt = await tx.wait();

      // Same reasoning as proposeSpend/deposit: decode this approval (and,
      // if it crossed the majority threshold, the resulting payout — both
      // land in this same transaction's receipt) directly rather than
      // waiting on the explorer-backed refreshes below to catch up.
      let newApprovalCount: number | null = null;
      let executedAmount: bigint | null = null;
      let executedTo: string | null = null;
      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = vault.interface.parseLog(log);
          if (parsed?.name === "SpendApproved" && parsed.args.proposalId === proposalId) {
            newApprovalCount = Number(parsed.args.approvalCount as bigint);
          }
          if (parsed?.name === "SpendExecuted" && parsed.args.proposalId === proposalId) {
            executedAmount = parsed.args.amount as bigint;
            executedTo = parsed.args.to as string;
          }
        } catch {
          // Not every log in the receipt is one of PotVault's own events (e.g. ERC20 Transfer) — skip those.
        }
      }

      const executedTxHash = receipt?.hash;
      const executedBlockNumber = receipt?.blockNumber;
      setProposals((prev) =>
        prev.map((p) =>
          p.proposalId === proposalId
            ? {
                ...p,
                approvalCount: newApprovalCount ?? p.approvalCount,
                approvedByMe: true,
                executed: executedAmount !== null ? true : p.executed,
                executedTxHash: executedAmount !== null ? executedTxHash : p.executedTxHash,
                executedBlockNumber: executedAmount !== null ? executedBlockNumber : p.executedBlockNumber
              }
            : p
        )
      );

      if (executedAmount !== null && executedTo && executedTxHash !== undefined && executedBlockNumber !== undefined) {
        const payout: ActivityItem = {
          type: "payout",
          amount: executedAmount,
          who: executedTo,
          blockNumber: executedBlockNumber,
          txHash: executedTxHash
        };
        setActivity((prev) => [payout, ...prev.filter((a) => a.txHash !== payout.txHash)]);

        // The TEE's private ledger only knows about deposits unless told
        // otherwise (see recordSpendExecuted in handlers.ts) — this is what
        // makes "Your private balance" actually go down when the pot spends
        // money, instead of only ever tracking deposit history.
        if (LOCAL_DEMO_MODE && executedTxHash) {
          await safeRefresh("spend debit", () =>
            recordSpendLocalDemo(potId, executedAmount!, executedTxHash, proposalId, signer)
          );
        }
      }

      await safeRefresh("proposals and activity", async () => {
        const list = await refreshProposals();
        await refreshActivity(list);
      });
      await safeRefresh("pot balance", refreshPotBalance);
      await safeRefresh("balance", refreshBalance);
    } catch (e) {
      console.error("approveSpend failed:", e);
      setError(friendlyError(e));
    } finally {
      setTimeout(() => setStatus(null), 4000);
    }
  }

  // Proposals/members/activity are only ever fetched once per mount (tied to
  // [signer, potId], not to which tab is open) — a member who opens the pot
  // before the block explorer has indexed a just-made proposal gets an empty
  // list with no obvious way to retry, since switching tabs doesn't re-fetch
  // and nothing prompts a page reload. These give every screen its own way
  // to ask again without one.
  async function refreshProposalsManually() {
    setRefreshingProposals(true);
    try {
      const list = await refreshProposals();
      await refreshActivity(list);
    } finally {
      setRefreshingProposals(false);
    }
  }

  async function refreshMembersManually() {
    setRefreshingMembers(true);
    try {
      await refreshMembers();
    } finally {
      setRefreshingMembers(false);
    }
  }

  async function refreshActivityManually() {
    setRefreshingActivity(true);
    try {
      await refreshActivity();
    } finally {
      setRefreshingActivity(false);
    }
  }

  return {
    potId,
    router,
    signer,
    address,
    connect,
    connecting,
    disconnect,
    initializing,
    members,
    membersLoaded,
    isMember,
    joining,
    joinThisPot,
    amount,
    setAmount,
    depositAmountValid,
    deposit,
    status,
    error,
    setError,
    balance,
    loadingBalance,
    refreshBalance,
    walletBalance,
    loadingWalletBalance,
    refreshWalletBalance,
    potBalance,
    inviteUrl,
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
    activity,
    refreshingProposals,
    refreshProposalsManually,
    refreshingMembers,
    refreshMembersManually,
    refreshingActivity,
    refreshActivityManually
  };
}

export type PotData = ReturnType<typeof usePot>;
