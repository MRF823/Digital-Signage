import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TIMEOUT_MS = 10 * 60 * 1000      // 10 minute
const WARNING_MS = 9 * 60 * 1000       // avertisment la 9 minute

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

export function useInactivityLogout() {
  const navigate = useNavigate()
  const logoutTimer = useRef(null)
  const warnTimer = useRef(null)
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const countdownRef = useRef(null)

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const reset = () => {
    setShowWarning(false)
    clearTimeout(logoutTimer.current)
    clearTimeout(warnTimer.current)
    clearInterval(countdownRef.current)

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(60)
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countdownRef.current); return 0 }
          return s - 1
        })
      }, 1000)
    }, WARNING_MS)

    logoutTimer.current = setTimeout(logout, TIMEOUT_MS)
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    reset()
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(logoutTimer.current)
      clearTimeout(warnTimer.current)
      clearInterval(countdownRef.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [])

  return { showWarning, secondsLeft, stayLoggedIn: reset }
}
