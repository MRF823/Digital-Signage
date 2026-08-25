import { useState, useCallback } from 'react'

const _p = new URLSearchParams(window.location.search)
const _agencyId = _p.get('agencyId') || 'default'
const _tvId = _p.get('tvId') || 'default'
const STORAGE_KEY = `signage_playlist_${_agencyId}_${_tvId}`

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
