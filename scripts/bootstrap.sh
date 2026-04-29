#!/usr/bin/env bash
# One-shot local setup for Career Autopilot.
# Usage: pnpm bootstrap

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "==> .env.local missing; copying from .env.example"
  cp .env.example .env.local
  echo "    Edit .env.local and re-run pnpm bootstrap."
  exit 1
fi

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Done. Next:"
echo "    pnpm db:migrate   # apply Supabase migrations"
echo "    pnpm db:types     # regenerate DB types"
echo "    pnpm dev          # start the web app"
