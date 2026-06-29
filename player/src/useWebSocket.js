import { useEffect, useRef, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_WS || `ws://${window.location.hostname}:4000`
const AGENCY_ID = import.meta.env.VITE_AGENCY_ID || '1'
const TV_ID = import.meta.env.VITE_TV_ID || 'TV-1'
const RECONNECT_MS = 10_000
const PING_MS = 30_000

export function useWebSocket(onMessage) {
  const ws = useRef(null)
  const pingTimer = useRef(null)
  const reconnectTimer = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return

    ws.current = new WebSocket(SERVER_URL)

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'register', agencyId: AGENCY_ID, tvId: TV_ID }))
      pingTimer.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_MS)
    }

    ws.current.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)) } catch {}
    }

    ws.current.onclose = () => {
      clearInterval(pingTimer.current)
      reconnectTimer.current = setTimeout(connect, RECONNECT_MS)
    }

    ws.current.onerror = () => ws.current?.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      ws.current?.close()
    }
  }, [connect])
}
