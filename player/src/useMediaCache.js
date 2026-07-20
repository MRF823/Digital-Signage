import { useState, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:4000`

export function useMediaCache() {
  const [ready, setReady] = useState(false)
  const [urls, setUrls] = useState({})

  const cachePlaylist = useCallback((items) => {
    const result = {}
    for (const item of items) {
      result[item.filename] = `${SERVER_URL}/api/media/${item.filename}`
    }
    setUrls(result)
    setReady(true)
  }, [])

  return { urls, ready, cachePlaylist }
}
