#!/usr/bin/env bash
# HTTP-вход на :80 → Vite :8080. Без HTTPS, чтобы Chrome не ломался на :8080.
set -euo pipefail
APP_DIR="${APP_DIR:-/home/ubuntu/fjord-acre-sky-solar}"
cd "$APP_DIR"

sudo cp "$APP_DIR/deploy/allservis.service" /etc/systemd/system/allservis.service
sudo systemctl daemon-reload
sudo systemctl reset-failed allservis || true
sudo systemctl enable --now allservis
sudo systemctl restart allservis

if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

sudo cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy || sudo systemctl restart caddy

PUB="$(curl -fsS ifconfig.me || echo 13.37.247.69)"
echo
echo "Готово. Откройте ИМЕННО так (с http, БЕЗ s, БЕЗ :8080):"
echo "  http://${PUB}"
echo
sudo systemctl is-active allservis caddy
curl -sI "http://127.0.0.1:80" | head -n 5 || true
