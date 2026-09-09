# All Servis — постоянный запуск

Проект на сервере: `/home/ubuntu/fjord-acre-sky-solar`
Это Node, не Python. Virtualenv не нужен — процесс держит systemd.

```
cd /home/ubuntu/fjord-acre-sky-solar
sudo git fetch origin
sudo git reset --hard origin/main
sudo cp deploy/allservis.service /etc/systemd/system/allservis.service
sudo systemctl daemon-reload
sudo systemctl reset-failed allservis
sudo systemctl enable --now allservis
sudo systemctl restart allservis
sudo systemctl status allservis --no-pager
```

Логи: `journalctl -u allservis -f`

`Restart=always` — если процесс упал, systemd поднимет его через 5 секунд.
