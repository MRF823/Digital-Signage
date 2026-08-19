import { Router } from 'express'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'

const router = Router()

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = getDb().prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.sub)
    res.json(user)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/users — lista utilizatori (admin)
router.get('/', requireAdmin, (req, res) => {
  try {
    const users = getDb().prepare('SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at').all()
    res.json(users)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/users — creare utilizator (admin)
router.post('/', requireAdmin, (req, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password || !role) return res.status(400).json({ error: 'Email, parolă și rol sunt obligatorii' })
  if (!['admin', 'operator', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rol invalid' })
  try {
    const hash = bcrypt.hashSync(password, 10)
    const result = getDb().prepare('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)').run(email.toLowerCase().trim(), hash, role, name || '')
    res.json({ id: result.lastInsertRowid })
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email deja există' })
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/users/:id — modificare utilizator (admin)
router.patch('/:id', requireAdmin, (req, res) => {
  const { name, role, password, is_active } = req.body
  const id = parseInt(req.params.id)
  try {
    const db = getDb()
    if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id)
    if (role !== undefined) {
      if (!['admin', 'operator', 'viewer'].includes(role)) return res.status(400).json({ error: 'Rol invalid' })
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
    }
    if (password !== undefined) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), id)
    if (is_active !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/users/:id — ștergere utilizator (admin, nu se poate șterge pe sine)
router.delete('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id)
  if (id === req.user.sub) return res.status(400).json({ error: 'Nu te poți șterge pe tine însuți' })
  try {
    getDb().prepare('DELETE FROM users WHERE id = ?').run(id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/auth/forgot-password — trimite email reset
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email obligatoriu' })
  try {
    const db = getDb()
    const user = db.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim())
    // Returnează ok indiferent (securitate)
    if (!user) return res.json({ ok: true })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt)

    try {
      const { sendPasswordReset } = await import('../mailer.js')
      await sendPasswordReset(email, token)
    } catch {
      // email-ul nu e configurat — token e creat dar nu trimis
    }

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/auth/reset-password — setează parolă nouă cu token
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token și parolă obligatorii' })
  if (password.length < 6) return res.status(400).json({ error: 'Parola trebuie să aibă minim 6 caractere' })
  try {
    const db = getDb()
    const reset = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0').get(token)
    if (!reset || new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'Link invalid sau expirat' })
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), reset.user_id)
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(reset.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
