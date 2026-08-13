/** Translates common wallet/chain/network errors into plain language for users
 *  with zero crypto background. Falls back to a trimmed version of the raw
 *  message when nothing matches, rather than hiding it entirely. */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();

  if (lower.includes("insufficient funds")) {
    return "You don't have enough C2FLR to pay for gas. Get some free C2FLR from the Coston2 faucet, then try again.";
  }
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("cancelled")) {
    return "You cancelled that in your wallet.";
  }
  if (lower.includes("already a member")) {
    return "You're already a member of this pot.";
  }
  if (lower.includes("not a pot member")) {
    return "You need to join this pot before you can do that.";
  }
  if (lower.includes("pot does not exist")) {
    return "This pot doesn't exist. Double-check the link you were given.";
  }
  if (lower.includes("pot already exists")) {
    return "A pot with that name already exists. Try a slightly different name.";
  }
  if (lower.includes("already approved")) {
    return "You've already approved this.";
  }
  if (lower.includes("already executed")) {
    return "This payment already went out.";
  }
  if (lower.includes("exceeds pot balance")) {
    return "That's more than the pot currently holds.";
  }
  if (lower.includes("amount must be")) {
    return "Enter an amount greater than zero.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (lower.includes("timed out")) {
    return "That took too long and timed out. Please try again.";
  }
  if (lower.includes("unconfigured_name") || lower.includes("resolvename")) {
    return "Something isn't configured correctly on our end. Please try again shortly.";
  }
  if (lower.includes("nonce")) {
    return "Your wallet's transaction queue got out of sync. Wait a few seconds and try again.";
  }

  // Fall back to the raw message, trimmed so a giant ethers error blob doesn't
  // take over the screen — still visible, just not the whole stack of detail.
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}
