#!/usr/bin/env bash
# generate-bindings.sh — Compile Solidity contracts and generate Go bindings.
#
# Prerequisites: forge (Foundry), jq
#
# Usage: ./scripts/generate-bindings.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Contract name and Go package ---
CONTRACT_NAME="QuietShareInstructionSender"
GO_PKG="quietshare"
BINDINGS_DIR="$PROJECT_DIR/tools/pkg/contracts/$GO_PKG"
SOURCE_FILE="QuietShareInstructionSender.sol"

cd "$PROJECT_DIR"

echo "=== Step 1: Compile Solidity contracts ==="
forge build

# Verify the contract name in the source matches what we expect
if ! grep -q "contract ${CONTRACT_NAME}" "$PROJECT_DIR/contracts/${SOURCE_FILE}" 2>/dev/null; then
    echo ""
    echo "ERROR: Contract name '${CONTRACT_NAME}' not found in contracts/${SOURCE_FILE}."
    echo "Make sure the contract name matches CONTRACT_NAME in this script."
    exit 1
fi

echo "=== Step 2: Extract ABI and BIN ==="
FORGE_OUT="$PROJECT_DIR/out/${SOURCE_FILE}/${CONTRACT_NAME}.json"
if [[ ! -f "$FORGE_OUT" ]]; then
    echo "ERROR: forge output not found at $FORGE_OUT"
    echo "Check that CONTRACT_NAME matches your Solidity contract name."
    exit 1
fi

mkdir -p "$BINDINGS_DIR"

# Extract ABI (JSON array)
jq '.abi' "$FORGE_OUT" > "$BINDINGS_DIR/${CONTRACT_NAME}.abi"

# Extract bytecode (hex string, strip 0x prefix)
jq -r '.bytecode.object' "$FORGE_OUT" | sed 's/^0x//' > "$BINDINGS_DIR/${CONTRACT_NAME}.bin"

echo "  ABI → $BINDINGS_DIR/${CONTRACT_NAME}.abi"
echo "  BIN → $BINDINGS_DIR/${CONTRACT_NAME}.bin"

echo "=== Step 3: Generate Go bindings ==="
cd "$PROJECT_DIR/tools"
go generate ./pkg/contracts/$GO_PKG/

echo "=== Done ==="
echo "Generated: $BINDINGS_DIR/autogen.go"
