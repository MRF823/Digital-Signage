import { useState, useCallback } from 'react'

const STORAGE_KEY = 'signage_playlist'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function usePlaylist() {
  const [playlist, setPlaylist] = useState(loadSaved)

  const update = useCallback((items) => {
    setPlaylist(items)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [])

  return { playlist, update }
}
