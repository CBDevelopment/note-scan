#!/usr/bin/env bash
# server-setup.sh — set up NoteScan on an existing droplet
#
# Assumes Docker, nginx, and certbot are already installed.
# Deploys the app at https://cutterbeck.com/notescan
#
# Usage (run as root or sudo user):
#   bash scripts/server-setup.sh <github-repo-url>
#
# Example:
#   bash scripts/server-setup.sh https://github.com/you/note-scan

set -euo pipefail

REPO_URL="${1:-}"
APP_DIR=/opt/notescan
NGINX_SNIPPET=/etc/nginx/snippets/notescan.conf
DOMAIN=cutterbeck.com
SUBPATH=/notescan
APP_PORT=3010

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 <github-repo-url>"
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()    { echo -e "\033[1;34m[setup]\033[0m $*"; }
success() { echo -e "\033[1;32m[setup]\033[0m $*"; }
prompt()  { read -rp $'\033[1;33m[input]\033[0m '"$1"': ' "$2"; }
prompt_secret() { read -rsp $'\033[1;33m[input]\033[0m '"$1"' (hidden): ' "$2"; echo; }

# ─── 1. Clone repo ────────────────────────────────────────────────────────────

if [[ -d "$APP_DIR/.git" ]]; then
  info "Repo already at $APP_DIR — pulling latest..."
  git -C "$APP_DIR" pull origin main
else
  info "Cloning $REPO_URL → $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
fi

# ─── 2. Create .env ───────────────────────────────────────────────────────────

ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  info ".env already exists at $ENV_FILE — skipping"
  info "Edit it manually if you need to change any values"
else
  info "Let's fill in your secrets now..."
  echo ""

  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  info "NEXTAUTH_SECRET auto-generated"

  prompt        "GOOGLE_CLIENT_ID"     GOOGLE_CLIENT_ID
  prompt_secret "GOOGLE_CLIENT_SECRET" GOOGLE_CLIENT_SECRET
  prompt_secret "ANTHROPIC_API_KEY"    ANTHROPIC_API_KEY

  echo ""
  info "Optional — press Enter to accept the defaults shown in []"

  read -rp $'\033[1;33m[input]\033[0m MONTHLY_BUDGET_CENTS [2000]: ' MONTHLY_BUDGET_CENTS
  MONTHLY_BUDGET_CENTS="${MONTHLY_BUDGET_CENTS:-2000}"

  cat > "$ENV_FILE" <<EOF
NEXTAUTH_URL=https://${DOMAIN}${SUBPATH}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NODE_ENV=production

GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

OCR_PROVIDER=anthropic
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
OCR_CONCURRENCY=5

MONTHLY_BUDGET_CENTS=${MONTHLY_BUDGET_CENTS}
RATE_LIMIT_PAGES_PER_HOUR=60
RATE_LIMIT_PAGES_PER_DAY=300
MAX_PAGES_PER_BATCH=30

DATABASE_URL=file:/data/notescan.db
EOF

  chmod 600 "$ENV_FILE"
  success ".env written"
fi

# ─── 3. nginx location block ──────────────────────────────────────────────────

info "Installing nginx location snippet → $NGINX_SNIPPET..."
mkdir -p /etc/nginx/snippets

cp "$APP_DIR/nginx-location.conf" "$NGINX_SNIPPET"

# Find the cutterbeck.com server block config file
NGINX_SITE=$(grep -rl "server_name.*${DOMAIN}" /etc/nginx/sites-enabled/ 2>/dev/null | head -1 || true)

if [[ -z "$NGINX_SITE" ]]; then
  NGINX_SITE=$(grep -rl "server_name.*${DOMAIN}" /etc/nginx/sites-available/ 2>/dev/null | head -1 || true)
fi

if [[ -z "$NGINX_SITE" ]]; then
  echo ""
  echo "  Could not find a nginx config for ${DOMAIN} automatically."
  echo "  Add this line manually inside your ${DOMAIN} server {} block:"
  echo ""
  echo "      include snippets/notescan.conf;"
  echo ""
else
  if grep -q "notescan.conf" "$NGINX_SITE"; then
    info "nginx include already present in $NGINX_SITE — skipping"
  else
    # Insert include before the closing brace of the last server block
    sed -i '/^}/{ x; /./{ x; s/^}/    include snippets\/notescan.conf;\n}/; b }; x }' "$NGINX_SITE"
    success "Added include to $NGINX_SITE"
  fi
fi

nginx -t
systemctl reload nginx
success "nginx reloaded"

# ─── 4. Build and start ───────────────────────────────────────────────────────

info "Building and starting the app (first build takes a few minutes)..."
cd "$APP_DIR"
docker compose up --build -d

success "Container started on 127.0.0.1:${APP_PORT}"

# ─── 5. Summary ───────────────────────────────────────────────────────────────

echo ""
success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success " NoteScan is live at https://${DOMAIN}${SUBPATH}"
success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Before you can sign in with Google, add this redirect URI"
echo "to your OAuth client in Google Cloud Console:"
echo ""
echo "    https://${DOMAIN}${SUBPATH}/api/auth/callback/google"
echo ""
echo "Useful commands:"
echo "  Logs:    docker compose -f $APP_DIR/docker-compose.yml logs -f"
echo "  Restart: docker compose -f $APP_DIR/docker-compose.yml restart"
echo "  Redeploy manually: bash $APP_DIR/scripts/deploy.sh"
echo ""
echo "GitHub Actions secrets to add (Settings → Secrets → Actions):"
echo "  DROPLET_HOST = $(curl -s ifconfig.me 2>/dev/null || echo '<your-droplet-ip>')"
echo "  DROPLET_USER = $(whoami)"
echo "  DROPLET_SSH_KEY = <your deploy private key>"
