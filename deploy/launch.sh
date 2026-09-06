#!/usr/bin/env bash
# All Servis — полный запуск на Ubuntu (AWS). Запускать с сервера:
#   bash deploy/launch.sh
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/fjord-acre-sky-solar}"
cd "$APP_DIR"

echo "== Node 22 =="
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "== Postgres =="
sudo apt-get install -y postgresql
sudo systemctl enable --now postgresql
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='allservis'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER allservis WITH PASSWORD 'SmeniteParol123';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='allservis'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE allservis OWNER allservis;"
fi

PUB_IP="$(curl -s ifconfig.me || true)"
SECRET="$(openssl rand -hex 32)"
if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL=postgres://allservis:SmeniteParol123@127.0.0.1:5432/allservis
BETTER_AUTH_URL=http://${PUB_IP}:8080
BETTER_AUTH_SECRET=${SECRET}
EOF
  echo "Created .env with BETTER_AUTH_URL=http://${PUB_IP}:8080"
else
  echo ".env already exists — not overwriting"
fi

echo "== deps =="
npm install
set -a
# shellcheck disable=SC1091
source .env
set +a
node scripts/migrate.mjs

echo "== systemd =="
sudo cp "$APP_DIR/deploy/allservis.service" /etc/systemd/system/allservis.service
sudo systemctl daemon-reload
sudo systemctl enable --now allservis
sudo systemctl restart allservis
sleep 5
sudo systemctl --no-pager --full status allservis || true
echo
echo "Open http://${PUB_IP}:8080"
echo "1) Создать аккаунт оператора (первый = владелец)"
echo "2) Настройки → бот заявок + бот логов"
echo "3) Команда → выдать доступ по email"
echo "Logs: sudo journalctl -u allservis -f"
