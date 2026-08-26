import { mkdirSync, readdirSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { getDb } from './db.js'
import { pushPlaylist, pushScreenPower, pushInfoPower, pushPlaylistForAgency } from './websocket.js'
import { getActivePlaylist } from './playlist.js'
import { todayRo } from './dateRo.js'
import { sendOfflineAlert, sendReconnectedAlert } from './mailer.js'

// 0=Luni, 1=Marti, ..., 6=Duminica
function getCurrentDayAndTime() {
  const now = new Date()
  const jsDay = now.getDay() // 0=Duminica, 1=Luni...
  const day = jsDay === 0 ? 6 : jsDay - 1 // convert: 0=Luni...6=Duminica
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return { day, time: `${hh}:${mm}` }
}

function getActiveSlot(db, groupId) {
  const { day, time } = getCurrentDayAndTime()
  const slots = db.prepare('SELECT * FROM schedule_slots WHERE group_id = ?').all(groupId)
  for (const slot of slots) {
    const days = slot.days.split(',').map(Number)
    if (days.includes(day) && time >= slot.start_time && time < slot.end_time) {
      const items = db.prepare(`
        SELECT ssi.*, m.filename, m.original_name, m.type, m.duration_seconds
        FROM schedule_slot_items ssi
        JOIN media m ON m.id = ssi.media_id
        WHERE ssi.slot_id = ?
        ORDER BY ssi.position
      `).all(slot.id)
      return { slotId: slot.id, items }
    }
  }
  return null
}

export function shouldScreenBeOn(powerOnTime, powerOffTime) {
  if (!powerOnTime || !powerOffTime) return true
  const { time } = getCurrentDayAndTime()
  if (powerOnTime < powerOffTime) {
    return time >= powerOnTime && time < powerOffTime
  }
  // overnight schedule (e.g. 22:00 – 06:00)
  return time >= powerOnTime || time < powerOffTime
}

// slotId activ per group (in memorie)
const activeSlotPerGroup = {}
const screenStatePerGroup = {}
const infoScreenStatePerAgency = {}

// Early Warning — TV-uri pentru care s-a trimis deja alertă offline (anti-spam)
const offlineAlertedTvs = new Set()

const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minute

function checkTvOffline() {
  try {
    const db = getDb()
    const tvs = db.prepare(`
      SELECT t.id, t.label, t.last_seen_at, a.name as agency_name
      FROM tvs t
      JOIN agencies a ON a.id = t.agency_id
      WHERE t.last_seen_at IS NOT NULL
    `).all()

    const now = Date.now()
    for (const tv of tvs) {
      const lastSeen = new Date(tv.last_seen_at + 'Z').getTime()
      const isOffline = (now - lastSeen) > OFFLINE_THRESHOLD_MS
      const key = `${tv.id}`

      if (isOffline && !offlineAlertedTvs.has(key)) {
        offlineAlertedTvs.add(key)
        console.log(`[early-warning] TV offline: ${tv.label} — ${tv.agency_name}`)
        sendOfflineAlert(tv.label, tv.agency_name)
      } else if (!isOffline && offlineAlertedTvs.has(key)) {
        offlineAlertedTvs.delete(key)
        console.log(`[early-warning] TV reconectat: ${tv.label} — ${tv.agency_name}`)
        sendReconnectedAlert(tv.label, tv.agency_name)
      }
    }
  } catch (err) {
    console.error('Early warning error:', err)
  }
}

function getGroupDefaultPlaylist(db, groupId) {
  const firstMember = db.prepare('SELECT agency_id FROM group_members WHERE group_id = ? LIMIT 1').get(groupId)
  if (!firstMember) return []
  return getActivePlaylist(firstMember.agency_id)
}

function checkPower() {
  try {
    const db = getDb()
    const groups = db.prepare('SELECT id, power_on_time, power_off_time FROM groups').all()
    for (const group of groups) {
      const shouldBeOn = shouldScreenBeOn(group.power_on_time, group.power_off_time)
      if (screenStatePerGroup[group.id] !== shouldBeOn) {
        screenStatePerGroup[group.id] = shouldBeOn
        const members = db.prepare('SELECT agency_id FROM group_members WHERE group_id = ?').all(group.id)
        for (const { agency_id } of members) {
          pushScreenPower(String(agency_id), shouldBeOn)
        }
        console.log(`Grup ${group.id}: ecran ${shouldBeOn ? 'ON' : 'OFF'}`)
      }
    }
  } catch (err) {
    console.error('Power scheduler error:', err)
  }
}

function checkSchedules() {
  try {
    const db = getDb()
    const groups = db.prepare('SELECT id FROM groups').all()
    for (const group of groups) {
      const active = getActiveSlot(db, group.id)
      const newSlotId = active ? active.slotId : null

      if (activeSlotPerGroup[group.id] !== newSlotId) {
        activeSlotPerGroup[group.id] = newSlotId
        const members = db.prepare('SELECT agency_id FROM group_members WHERE group_id = ?').all(group.id)
        const playlist = active ? active.items : getGroupDefaultPlaylist(db, group.id)
        for (const { agency_id } of members) {
          pushPlaylist(String(agency_id), playlist)
        }
        console.log(`Grup ${group.id}: slot ${newSlotId ?? 'default'} activ`)
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err)
  }
}

function checkInfoPower() {
  try {
    const db = getDb()
    const agencies = db.prepare('SELECT id, info_on_time, info_off_time FROM agencies WHERE info_on_time IS NOT NULL AND info_off_time IS NOT NULL').all()
    for (const agency of agencies) {
      const shouldBeOn = shouldScreenBeOn(agency.info_on_time, agency.info_off_time)
      if (infoScreenStatePerAgency[agency.id] !== shouldBeOn) {
        infoScreenStatePerAgency[agency.id] = shouldBeOn
        pushInfoPower(String(agency.id), shouldBeOn)
        console.log(`Info agenție ${agency.id}: ecran ${shouldBeOn ? 'ON' : 'OFF'}`)
      }
    }
  } catch (err) {
    console.error('Info power scheduler error:', err)
  }
}

function checkCampaigns() {
  try {
    const db = getDb()
    const agencies = db.prepare('SELECT id FROM agencies').all()
    for (const agency of agencies) {
      pushPlaylistForAgency(String(agency.id))
    }
  } catch (err) {
    console.error('Campaign scheduler error:', err)
  }
}

function backupDb() {
  try {
    const backupDir = resolve(process.cwd(), 'backups')
    mkdirSync(backupDir, { recursive: true })
    const date = todayRo()
    const dest = join(backupDir, `signage-${date}.db`)
    getDb().backup(dest).then(() => {
      const files = readdirSync(backupDir)
        .filter(f => f.startsWith('signage-') && f.endsWith('.db'))
        .sort()
      if (files.length > 7) {
        files.slice(0, files.length - 7).forEach(f => {
          try { unlinkSync(join(backupDir, f)) } catch {}
        })
      }
      console.log(`Backup DB: ${dest}`)
    }).catch(err => console.error('Backup DB error:', err))
  } catch (err) {
    console.error('Backup DB error:', err)
  }
}

export function initScheduler() {
  // Verifică schedule-uri și power la fiecare minut
  setInterval(() => { checkSchedules(); checkPower(); checkInfoPower() }, 60_000)
  checkSchedules()
  checkPower()
  checkInfoPower()

  // Early Warning — verifică TV-uri offline la fiecare 5 minute
  setInterval(checkTvOffline, 5 * 60_000)
  setTimeout(checkTvOffline, 60_000) // primul check după 1 min (să se conecteze TV-urile la boot)

  // Verifică campanii la miezul nopții
  const now = new Date()
  const nextMidnight = new Date(now)
  nextMidnight.setDate(now.getDate() + 1)
  nextMidnight.setHours(0, 1, 0, 0)
  setTimeout(() => {
    checkCampaigns()
    setInterval(checkCampaigns, 24 * 60 * 60 * 1000)
  }, nextMidnight - now)

  // Backup DB zilnic la 02:00
  const next2am = new Date(now)
  if (now.getHours() >= 2) next2am.setDate(now.getDate() + 1)
  next2am.setHours(2, 0, 0, 0)
  setTimeout(() => {
    backupDb()
    setInterval(backupDb, 24 * 60 * 60 * 1000)
  }, next2am - now)

  console.log('Scheduler pornit')
}

export { getActiveSlot }
