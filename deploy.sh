#!/bin/bash
# Deploy cod pe VPS (fara DB, fara uploads, fara WAL files)
# Rulati INTOTDEAUNA de pe Mac, NU de pe VPS SSH

rsync -avz \
  -e "ssh -i ~/.ssh/signage-server.key" \
  --exclude node_modules \
  --exclude .git \
  --exclude '_backup_*' \
  --exclude 'server/uploads' \
  --exclude 'server/signage.db' \
  --exclude 'server/signage.db-shm' \
  --exclude 'server/signage.db-wal' \
  --exclude 'server/.env' \
  /Users/floricamarius/digital-signage/ \
  ubuntu@92.5.28.167:/home/ubuntu/digital-signage/

echo ""
echo "Deploy gata! Acum SSH si pm2 restart:"
echo "  ssh -i ~/.ssh/signage-server.key ubuntu@92.5.28.167"
echo "  pm2 restart signage-server"
