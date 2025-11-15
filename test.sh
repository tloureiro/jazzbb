#!/usr/bin/env bash

set -euo pipefail

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Starting dev server..."
npm run dev
