import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from './index.js'
import { initDb } from './db.js'

beforeEach(() => initDb(':memory:'))

describe('POST /api/login', () => {
  it('returns 200 and token with valid credentials', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  it('returns 401 with wrong password', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' })
    expect(res.status).toBe(401)
  })
})

describe('requireAuth middleware', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/media')
    expect(res.status).toBe(401)
  })

  it('allows requests with valid token', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
    const res = await request(app)
      .get('/api/agencies')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(res.status).toBe(200)
  })
})
