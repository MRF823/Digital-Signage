import { describe, it, expect, beforeEach } from 'vitest'
import { initDb, getDb } from './db.js'

beforeEach(() => { initDb(':memory:') })

describe('initDb', () => {
  it('creates all tables', () => {
    const db = getDb()
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name)
    expect(tables).toContain('media')
    expect(tables).toContain('agencies')
    expect(tables).toContain('tvs')
    expect(tables).toContain('playlist_items')
    expect(tables).toContain('admin')
  })

  it('seeds 10 agencies', () => {
    const db = getDb()
    const count = db.prepare('SELECT COUNT(*) as c FROM agencies').get()
    expect(count.c).toBe(10)
  })
})
