// server/src/routes/media.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { initDb, getDb } from '../db.js'

let token
beforeEach(async () => {
  initDb(':memory:')
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
  token = res.body.token
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/media', () => {
  it('returns empty array when no media', async () => {
    const res = await request(app).get('/api/media').set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('DELETE /api/media/:id', () => {
  it('returns 404 for non-existent media', async () => {
    const res = await request(app).delete('/api/media/999').set(auth())
    expect(res.status).toBe(404)
  })
})
