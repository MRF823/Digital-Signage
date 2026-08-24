import { getDb } from './db.js'
import { todayRo } from './dateRo.js'

// Convenție: "Nume campanie - Tip TV" → campania merge DOAR pe TV-ul cu acel label
// Fără sufix → merge pe toate TV-urile normale din agenție
function campaignMatchesTv(campaignName, tvLabel) {
  const match = campaignName.match(/ - (.+)$/i)
  if (!match) return true
  return match[1].trim().toLowerCase() === tvLabel.trim().toLowerCase()
}

export function getActivePlaylist(agencyId, tvLabel = null) {
  const db = getDb()
  const now = todayRo()

  const campaigns = db.prepare(`
    SELECT * FROM campaigns
    WHERE agency_id = ? AND start_date <= ? AND end_date > ?
    ORDER BY start_date DESC
  `).all(agencyId, now, now)

  const campaign = tvLabel
    ? campaigns.find(c => campaignMatchesTv(c.name, tvLabel))
    : campaigns[0]

  if (campaign) {
    return db.prepare(`
      SELECT ci.*, m.filename, m.original_name, m.type, m.duration_seconds
      FROM campaign_items ci
      JOIN media m ON m.id = ci.media_id
      WHERE ci.campaign_id = ?
      ORDER BY ci.position
    `).all(campaign.id)
  }

  // Fallback — playlist default
  return db.prepare(`
    SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
    FROM playlist_items pi
    JOIN media m ON m.id = pi.media_id
    WHERE pi.agency_id = ?
    ORDER BY pi.position
  `).all(agencyId)
}
