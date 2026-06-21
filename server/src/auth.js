import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db.js'

const SECRET = process.env.JWT_SECRET || 'changeme-in-production'

export function loginHandler(req, res) {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' })

  const admin = getDb().prepare('SELECT * FROM admin WHERE username = ?').get(username)
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ sub: admin.id }, SECRET, { expiresIn: '24h' })
  res.json({ token })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    jwt.verify(header.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
