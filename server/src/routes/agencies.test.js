import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { initDb, getDb } from '../db.js'

let token
beforeAll(async () => {
  initDb(':memory:')
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
  token = res.body.token
})

beforeEach(() => {
  initDb(':memory:')
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/agencies', () => {
  it('returns 10 seeded agencies each with tvs array', async () => {
    const res = await request(app).get('/api/agencies').set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(10)
    expect(res.body[0]).toHaveProperty('tvs')
  })
})

describe('POST /api/agencies', () => {
  it('creates a new agency with no TVs', async () => {
    const res = await request(app)
      .post('/api/agencies')
      .set(auth())
      .send({ name: 'Agenția Test', city: 'Cluj' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Agenția Test')
    expect(res.body.tvs).toEqual([])
  })

  it('returns 400 when name or city missing', async () => {
    const res = await request(app).post('/api/agencies').set(auth()).send({ name: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/agencies/:id', () => {
  it('deletes agency and its TVs and playlist', async () => {
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'Del', city: 'Y' })
    const id = created.body.id

    const res = await request(app).delete(`/api/agencies/${id}`).set(auth())
    expect(res.status).toBe(204)

    const check = await request(app).get('/api/agencies').set(auth())
    expect(check.body.find(a => a.id === id)).toBeUndefined()
  })
})

describe('POST /api/agencies/:id/tvs', () => {
  it('adds a TV to an agency', async () => {
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'TV Test Agency', city: 'Cluj' })
    const agencyId = created.body.id

    const res = await request(app)
      .post(`/api/agencies/${agencyId}/tvs`)
      .set(auth())
      .send({ label: 'TV-Recepție' })
    expect(res.status).toBe(201)
    expect(res.body.label).toBe('TV-Recepție')
    expect(res.body.agency_id).toBe(agencyId)
  })

  it('returns 400 when label missing', async () => {
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'TV Test Agency 2', city: 'Iași' })
    const agencyId = created.body.id

    const res = await request(app).post(`/api/agencies/${agencyId}/tvs`).set(auth()).send({})
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/tvs/:tvId', () => {
  it('deletes a TV', async () => {
    const db = getDb()
    const tv = db.prepare('SELECT id FROM tvs LIMIT 1').get()
    const res = await request(app).delete(`/api/tvs/${tv.id}`).set(auth())
    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent TV', async () => {
    const res = await request(app).delete('/api/tvs/99999').set(auth())
    expect(res.status).toBe(404)
  })
})

describe('POST /api/agencies/:id/playlist', () => {
  it('sets playlist and returns items', async () => {
    const db = getDb()
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'Playlist Agency', city: 'Test' })
    const agencyId = created.body.id

    const media = db.prepare(
      `INSERT INTO media (filename, original_name, type, size_bytes) VALUES ('f.mp4','orig.mp4','video',1000)`
    ).run()

    const res = await request(app)
      .post(`/api/agencies/${agencyId}/playlist`)
      .set(auth())
      .send({ items: [{ media_id: media.lastInsertRowid, display_duration_seconds: null }] })

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].media_id).toBe(media.lastInsertRowid)
  })
})

describe('GET /api/agencies/:id/playlist', () => {
  it('returns empty array when no playlist set', async () => {
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'Playlist Test Agency', city: 'București' })
    const agencyId = created.body.id

    const res = await request(app).get(`/api/agencies/${agencyId}/playlist`).set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 404 for non-existent agency', async () => {
    const res = await request(app).get('/api/agencies/99999/playlist').set(auth())
    expect(res.status).toBe(404)
  })
})
