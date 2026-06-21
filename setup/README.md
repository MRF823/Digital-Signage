# Setup Raspberry Pi

## 1. Flashează Raspberry Pi OS Lite (64-bit) pe card SD

Recomandare: folosește **Raspberry Pi Imager** și activează SSH + WiFi înainte de flash.

## 2. Conectează-te prin SSH și instalează dependințele

```bash
sudo apt update && sudo apt install -y nodejs npm chromium-browser xorg openbox curl
```

## 3. Configurează variabilele de mediu pentru această agenție

```bash
sudo mkdir -p /etc/signage
sudo tee /etc/signage/config.env <<EOF
VITE_SERVER_URL=https://your-domain.com
VITE_SERVER_WS=wss://your-domain.com
VITE_AGENCY_ID=3
VITE_TV_ID=TV-1
EOF
```

> Schimbă `VITE_AGENCY_ID` și `VITE_TV_ID` pentru fiecare Pi în parte.

## 4. Clonează repo-ul și build-uiește player-ul

```bash
cd /home/pi
git clone <repo-url> signage
cd signage/player

# Copiază env-ul de producție
sudo cp /etc/signage/config.env .env

npm install
npm run build
```

## 5. Instalează serviciul systemd

```bash
sudo cp /home/pi/signage/setup/signage.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable signage
sudo systemctl start signage
```

## 6. Configurează Chromium să pornească în kiosk la boot

```bash
mkdir -p ~/.config/openbox
echo '/home/pi/signage/setup/start-chromium.sh &' >> ~/.config/openbox/autostart
chmod +x /home/pi/signage/setup/start-chromium.sh
```

## 7. Repornește Pi-ul

```bash
sudo reboot
```

TV-ul va porni automat în kiosk mode și va afișa conținutul asignat agenției respective.

## Actualizare conținut player

La noi release-uri, pe fiecare Pi:

```bash
cd /home/pi/signage
git pull
cd player && npm install && npm run build
sudo systemctl restart signage
```

## Configurare server (VPS)

Copiază `nginx.conf` în `/etc/nginx/sites-available/signage` și înlocuiește `your-domain.com`:

```bash
sudo cp /home/ubuntu/signage/setup/nginx.conf /etc/nginx/sites-available/signage
sudo ln -s /etc/nginx/sites-available/signage /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo nginx -t && sudo systemctl reload nginx
```

Pornește serverul cu PM2:

```bash
cd /home/ubuntu/signage/server
npm install
npm install -g pm2
pm2 start src/index.js --name signage-server
pm2 save
pm2 startup
```
