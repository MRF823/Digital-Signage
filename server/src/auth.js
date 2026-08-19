import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db.js'

const SECRET = process.env.JWT_SECRET || 'changeme-in-production'

export function loginHandler(req, res) {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email și parola sunt obligatorii' })

  const user = getDb().prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim())
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email sau parolă incorectă' })
  }

  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name }, SECRET, { expiresIn: '24h' })
  res.json({ token, role: user.role, name: user.name })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(header.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireOperator(req, res, next) {
  requireAuth(req, res, () => {
    if (!['admin', 'operator'].includes(req.user.role)) return res.status(403).json({ error: 'Acces interzis' })
    next()
  })
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' })
    next()
  })
}
