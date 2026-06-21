#!/bin/bash
# Kiosk launcher — runs after signage.service is up
sleep 5
export DISPLAY=:0
xset s off
xset -dpms
xset s noblank
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --check-for-update-interval=31536000 \
  http://localhost:3000
