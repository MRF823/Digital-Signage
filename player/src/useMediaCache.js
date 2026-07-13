import { useState, useCallback } from 'react'

const _urlParams = new URLSearchParams(window.location.search)
const SERVER_URL = _urlParams.get('mediaServer') || import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:4000`
const DB_NAME = 'signage-cache'
const STORE = 'media'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = reject
  })
}

async function getCached(db, filename) {
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(filename)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function putCached(db, filename, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, filename)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}

export function useMediaCache() {
  const [ready, setReady] = useState(false)
  const [urls, setUrls] = useState({})

  const cachePlaylist = useCallback(async (items) => {
    const db = await openDb()
    const result = {}

    for (const item of items) {
      const cached = await getCached(db, item.filename)
      if (cached) {
        result[item.filename] = URL.createObjectURL(cached)
      } else {
        try {
          const res = await fetch(`${SERVER_URL}/api/media/${item.filename}`, {
            signal: AbortSignal.timeout(120_000),
          })
          if (!res.ok) continue
          const blob = await res.blob()
          await putCached(db, item.filename, blob)
          result[item.filename] = URL.createObjectURL(blob)
        } catch {
          // download eșuat — fallback la URL direct pentru streaming
          result[item.filename] = `${SERVER_URL}/api/media/${item.filename}`
        }
      }
    }

    setUrls(result)
    setReady(true)
  }, [])

  return { urls, ready, cachePlaylist }
}
