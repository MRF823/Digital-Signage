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
  `)

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
