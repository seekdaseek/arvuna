#!/bin/sh
# Runs the external GNU Taler wallet CLI (Docker image built from tools/wallet) with a persistent test wallet in ./.wallet.
# Usage: scripts/taler-wallet.sh balance | handle-uri -y 'taler://...' | ...
cd "$(dirname "$0")/.." || exit 1
mkdir -p .wallet
exec docker run --rm -v "$PWD/.wallet:/data" arvuna-taler-wallet --wallet-db=/data/wallet.db "$@"
