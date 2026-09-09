# All Servis — постоянный запуск

Это Node-приложение, не Python. Virtualenv не нужен: процесс держит **systemd** и сам поднимает его после падения и после reboot.

```
cd /opt/allservis
sudo git fetch origin
sudo git reset --hard origin/main
sudo cp deploy/allservis.service /etc/systemd/system/allservis.service
sudo systemctl daemon-reload
sudo systemctl enable --now allservis
sudo systemctl restart allservis
sudo systemctl status allservis
```

Логи: `journalctl -u allservis -f`

`Restart=always` — если процесс упал, systemd поднимет его через 5 секунд.
