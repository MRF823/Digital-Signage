#!/bin/bash
# Backup automat SQLite — rulează zilnic la 03:00
# Păstrează ultimele 30 de zile

DB_PATH="/home/ubuntu/digital-signage/server/signage.db"
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/signage_$TIMESTAMP.db"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Backup atomic cu SQLite WAL checkpoint
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
  echo "[backup] OK — $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  echo "[backup] EROARE la backup $TIMESTAMP" >&2
  exit 1
fi

# Șterge backup-urile mai vechi de 30 zile
find "$BACKUP_DIR" -name "signage_*.db" -mtime +$KEEP_DAYS -delete
echo "[backup] Backup-uri păstrate: $(ls $BACKUP_DIR/signage_*.db 2>/dev/null | wc -l)"
