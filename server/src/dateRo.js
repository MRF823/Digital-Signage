// Returnează data curentă în fusul orar România (Europe/Bucharest) ca "YYYY-MM-DD"
export function todayRo() {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Bucharest' }).format(new Date())
}

// Returnează data de peste `days` zile în fusul orar România
export function futureDateRo(days) {
  return new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Bucharest' }).format(new Date(Date.now() + days * 86400_000))
}
