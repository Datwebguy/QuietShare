#!/usr/bin/env bash
# check-docs.sh — validate the shared docs standard (see docs/README.md).
#
# Checks presence, that the platform-wide traps are actually covered, and that
# nothing has grown too long to be read by a tester. Content checks match on
# keywords rather than headings so rewording does not break them.
#
# Keep this file identical across extensions; the only per-repo difference is
# ONE_SHOT_SETTER below.
#
# Exit 1 on a missing/incomplete required doc; long docs only warn.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS="$(cd "$SCRIPT_DIR/.." && pwd)/docs"

RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'
fail=0
err()  { echo -e "${RED}FAIL${NC}  $*"; fail=1; }
warn() { echo -e "${YELLOW}WARN${NC}  $*"; }
ok()   { echo -e "${GREEN}ok${NC}    $*"; }

# The one-shot binding differs per extension: shielded-transfer binds the vault's
# teeAuthority, orderbook binds the InstructionSender's teeAddress.
ONE_SHOT_SETTER="setExtensionId"

REQUIRED="getting-started.md deployment-steps.md testing.md testing-against-coston2.md architecture.md cloudflared.md"
SCAFFOLD="extension-guide.md instruction-sender.md manual-setup.md types-server.md"
MAX_LINES=400   # past this a tester stops reading; split or cut

echo "docs: $DOCS"
echo

for f in $REQUIRED; do
    p="$DOCS/$f"
    if [[ ! -f "$p" ]]; then err "$f missing (required)"; continue; fi
    n=$(wc -l <"$p")
    # 20 lines is about the floor for a real doc; below that it is a stub.
    if (( n < 20 )); then err "$f is only $n lines — stub?"; continue; fi
    (( n > MAX_LINES )) && warn "$f is $n lines (>$MAX_LINES) — trim or split"
    ok "$f ($n lines)"
done

echo
for f in $SCAFFOLD; do
    [[ -f "$DOCS/$f" ]] && ok "$f (scaffold)" || warn "$f missing — scaffold doc, expected"
done

# Platform traps every extension hits. Absent = the doc will not save anyone.
echo
D="$DOCS/deployment-steps.md"
if [[ -f "$D" ]]; then
    check() { grep -qiF "$2" "$D" && ok "deployment-steps: $1" || err "deployment-steps: missing $1 (looked for '$2')"; }
    check "stale-machine pausing"        "pause("
    check "active-machine listing"       "getActiveTeeMachines"
    check "one-shot binding warning"     "$ONE_SHOT_SETTER"
    check "launch-policy env override"   "allow_env_override"
    check "digest-pinned deploy"         "digest"
    check "attestation mode"             "SIMULATED_TEE"
fi

echo
if [[ -f "$DOCS/README.md" ]]; then ok "docs/README.md index present"; else err "docs/README.md index missing"; fi

echo
if (( fail )); then echo -e "${RED}docs standard: FAILED${NC}"; else echo -e "${GREEN}docs standard: OK${NC}"; fi
exit $fail
