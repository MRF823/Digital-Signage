const QUEUE_KEY = 'bancasign_play_queue'

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

export function enqueueLog(log) {
  try {
    const q = getQueue()
    q.push(log)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {}
}

export function flushQueue(sendFn) {
  try {
    const q = getQueue()
    if (!q.length) return
    q.forEach(log => sendFn(log))
    localStorage.removeItem(QUEUE_KEY)
  } catch {}
}
