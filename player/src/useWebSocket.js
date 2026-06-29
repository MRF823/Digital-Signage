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

    const socket = new WebSocket(SERVER_URL)
    ws.current = socket

    socket.onopen = () => {
      if (ws.current !== socket) { socket.close(); return }
      socket.send(JSON.stringify({ type: 'register', agencyId: AGENCY_ID, tvId: TV_ID }))
      pingTimer.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_MS)
    }

    socket.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)) } catch {}
    }

    socket.onclose = () => {
      if (ws.current !== socket) return
      clearInterval(pingTimer.current)
      reconnectTimer.current = setTimeout(connect, RECONNECT_MS)
    }

    socket.onerror = () => socket.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      const socket = ws.current
      ws.current = null
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      socket?.close()
    }
  }, [connect])
}
