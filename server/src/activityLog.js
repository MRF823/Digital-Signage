import { getDb } from './db.js'

export function logActivity(email, name, action, details = null) {
  try {
    getDb().prepare(
      'INSERT INTO activity_log (user_email, user_name, action, details) VALUES (?, ?, ?, ?)'
    ).run(email, name, action, details ? JSON.stringify(details) : null)
  } catch {}
}
