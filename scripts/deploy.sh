#!/usr/bin/env bash
# deploy.sh — pull the pre-built image from GHCR and restart the app
# Called by GitHub Actions after each successful build.

set -euo pipefail

APP_DIR=/opt/notescan

cd "$APP_DIR"

echo "[deploy] Pulling latest code..."
git pull origin main

echo "[deploy] Logging in to GHCR..."
# GHCR_TOKEN is stored in .env (read:packages PAT)
GHCR_TOKEN=$(grep '^GHCR_TOKEN=' "$APP_DIR/.env" | cut -d= -f2-)
echo "$GHCR_TOKEN" | docker login ghcr.io -u CBDevelopment --password-stdin

echo "[deploy] Pulling new image..."
docker compose pull

echo "[deploy] Restarting container..."
docker compose up -d

echo "[deploy] Pruning old images..."
docker image prune -f

echo "[deploy] Done"
docker compose ps
