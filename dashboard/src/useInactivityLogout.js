import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const TIMEOUT_MS = 10 * 60 * 1000

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

export function useInactivityLogout() {
  const navigate = useNavigate()
  const timer = useRef(null)

  const reset = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      localStorage.removeItem('token')
      navigate('/login')
    }, TIMEOUT_MS)
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    reset()
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [])

  return {}
}
