#!/usr/bin/env bash
# deploy.sh — pull latest code and restart the app
# Called by GitHub Actions on every push to main.
# Can also be run manually on the server.

set -euo pipefail

APP_DIR=/opt/notescan

cd "$APP_DIR"

echo "[deploy] Pulling latest code..."
git pull origin main

echo "[deploy] Rebuilding and restarting containers..."
docker compose up --build -d

echo "[deploy] Removing dangling images..."
docker image prune -f

echo "[deploy] Done — app is running"
docker compose ps
