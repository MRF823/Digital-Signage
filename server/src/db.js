import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

let db

export function initDb(path = './signage.db') {
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  // null for video (uses natural duration), seconds for images (default 10)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('video','image')),
      size_bytes INTEGER NOT NULL,
      duration_seconds REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      label TEXT NOT NULL,
      last_seen_at TEXT,
      ip_address TEXT
    );
    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      media_id INTEGER NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL,
      display_duration_seconds REAL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id),
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      UNIQUE(agency_id)
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS campaign_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
      media_id INTEGER NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL,
      display_duration_seconds REAL
    );
    CREATE TABLE IF NOT EXISTS schedule_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id),
      name TEXT NOT NULL,
      days TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS schedule_slot_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER NOT NULL REFERENCES schedule_slots(id),
      media_id INTEGER NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL,
      display_duration_seconds REAL
    );
    CREATE TABLE IF NOT EXISTS play_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id TEXT NOT NULL,
      tv_label TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      played_at TEXT NOT NULL,
      duration_seconds INTEGER
    );
  `)

  // Migrări pentru coloane noi
  try { db.exec('ALTER TABLE agencies ADD COLUMN lat REAL') } catch {}
  try { db.exec('ALTER TABLE agencies ADD COLUMN lng REAL') } catch {}
  try { db.exec("ALTER TABLE groups ADD COLUMN transition TEXT NOT NULL DEFAULT 'fade'") } catch {}
  try { db.exec('ALTER TABLE groups ADD COLUMN power_on_time TEXT') } catch {}
  try { db.exec('ALTER TABLE groups ADD COLUMN power_off_time TEXT') } catch {}
  try { db.exec("ALTER TABLE tvs ADD COLUMN orientation TEXT NOT NULL DEFAULT 'landscape'") } catch {}

  // Coordonate implicite per oraș
  const cityCoords = {
    'București': [44.4268, 26.1025],
    'Cluj-Napoca': [46.7712, 23.6236],
    'Timișoara': [45.7489, 21.2087],
    'Iași': [47.1585, 27.6014],
    'Brașov': [45.6427, 25.5887],
    'Constanța': [44.1598, 28.6348],
    'Sibiu': [45.7983, 24.1256],
    'Oradea': [47.0465, 21.9189],
    'Craiova': [44.3302, 23.7949],
  }
  const agenciesWithoutCoords = db.prepare('SELECT id, city FROM agencies WHERE lat IS NULL').all()
  const updateCoords = db.prepare('UPDATE agencies SET lat = ?, lng = ? WHERE id = ?')
  for (const a of agenciesWithoutCoords) {
    const coords = cityCoords[a.city]
    if (coords) updateCoords.run(coords[0], coords[1], a.id)
  }

  const adminExists = db.prepare('SELECT id FROM admin LIMIT 1').get()
  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10)
    db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('admin', hash)
  }

  const agencyCount = db.prepare('SELECT COUNT(*) as c FROM agencies').get()
  if (agencyCount.c === 0) {
    const agencies = [
      { name: 'Agenția Centrală', city: 'București' },
      { name: 'Agenția Floreasca', city: 'București' },
      { name: 'Agenția Cluj-Napoca', city: 'Cluj-Napoca' },
      { name: 'Agenția Timișoara', city: 'Timișoara' },
      { name: 'Agenția Iași', city: 'Iași' },
      { name: 'Agenția Brașov', city: 'Brașov' },
      { name: 'Agenția Constanța', city: 'Constanța' },
      { name: 'Agenția Sibiu', city: 'Sibiu' },
      { name: 'Agenția Oradea', city: 'Oradea' },
      { name: 'Agenția Craiova', city: 'Craiova' },
    ]
    const insert = db.prepare('INSERT INTO agencies (name, city) VALUES (@name, @city)')
    const insertMany = db.transaction((rows) => rows.forEach(r => insert.run(r)))
    insertMany(agencies)

    // 2 TVs per agency as default seed
    const allAgencies = db.prepare('SELECT id FROM agencies').all()
    const tvInsert = db.prepare('INSERT INTO tvs (agency_id, label) VALUES (?, ?)')
    const tvTx = db.transaction((rows) => {
      rows.forEach(a => {
        tvInsert.run(a.id, 'TV-1')
        tvInsert.run(a.id, 'TV-2')
      })
    })
    tvTx(allAgencies)
  }
}

export function getDb() {
  return db
}
