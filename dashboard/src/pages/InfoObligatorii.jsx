import { useEffect, useState, useRef } from 'react'
import { getAgencies, getInfoTVs, getInfoDocs, uploadInfoDoc, deleteInfoDoc, reorderInfoDocs, setInfoRotation, setInfoSchedule, toggleInfoMode } from '../api'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen + 'Z').getTime()) < 2 * 60 * 1000
}

function UploadButton({ agencyId, side, onUploaded }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setProgress(0)
    try {
      const doc = await uploadInfoDoc(agencyId, file, side, p => setProgress(p))
      onUploaded(doc)
    } catch {
      alert('Eroare la upload. Verifică că fișierul este PDF.')
    } finally {
      setUploading(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50"
        style={{ border: '1px dashed var(--accent)', color: 'var(--accent)', background: 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {uploading ? (
          <span>{progress}%</span>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload PDF
          </>
        )}
      </button>
    </div>
  )
}

function DocList({ docs, agencyId, onDelete, onReorder }) {
  const move = async (idx, dir) => {
    const newDocs = [...docs]
    const target = idx + dir
    if (target < 0 || target >= newDocs.length) return
    ;[newDocs[idx], newDocs[target]] = [newDocs[target], newDocs[idx]]
    onReorder(newDocs)
    try {
      await reorderInfoDocs(agencyId, newDocs.map(d => d.id))
    } catch {
      onReorder(docs)
    }
  }

  return (
    <div className="space-y-1.5">
      {docs.map((doc, idx) => (
        <div key={doc.id} className="flex items-center gap-1 px-3 py-2 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="disabled:opacity-20 leading-none transition-colors"
              style={{ color: 'var(--fg-3)' }}
              title="Mută sus"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button
              onClick={() => move(idx, 1)}
              disabled={idx === docs.length - 1}
              className="disabled:opacity-20 leading-none transition-colors"
              style={{ color: 'var(--fg-3)' }}
              title="Mută jos"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="flex-shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="text-sm truncate" style={{ color: 'var(--fg-2)' }}>{doc.original_name}</span>
          </div>
          <a
            href={`/api/info/file/${doc.filename}`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors flex-shrink-0"
            style={{ color: 'var(--fg-3)' }}
            title="Vizualizează PDF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </a>
          <button
            onClick={() => onDelete(doc.id)}
            className="transition-colors flex-shrink-0"
            style={{ color: 'var(--fg-3)' }}
            title="Șterge"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function AgencyCard({ agency, tv, initialData }) {
  const [docs, setDocs] = useState(initialData?.docs ?? [])
  const [rotationSec, setRotationSec] = useState(initialData?.rotation_seconds ?? 5)
  const [onTime, setOnTime] = useState(initialData?.on_time ?? '')
  const [offTime, setOffTime] = useState(initialData?.off_time ?? '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [tvMode, setTvMode] = useState(tv?.info_mode ?? 0)

  const staticDocs = docs.filter(d => d.side === 'static')
  const rotativDocs = docs.filter(d => d.side === 'rotativ')
  const online = tv ? isOnline(tv.last_seen_at) : false

  async function handleDelete(docId) {
    if (!confirm('Ștergi documentul?')) return
    try {
      await deleteInfoDoc(docId)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch {
      alert('Eroare la ștergere.')
    }
  }

  function handleUploaded(doc) {
    setDocs(prev => [...prev, doc])
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await setInfoRotation(agency.id, rotationSec)
      await setInfoSchedule(agency.id, onTime || null, offTime || null)
    } catch {
      alert('Eroare la salvare.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleToggle() {
    if (!tv) return
    setToggling(true)
    try {
      const result = await toggleInfoMode(tv.id)
      setTvMode(result.info_mode)
    } catch {
      alert('Eroare la toggle.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header agenție */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: tv ? (online ? '#10B981' : 'var(--fg-3)') : 'var(--border)' }} />
          <div>
            <p className="font-medium" style={{ color: 'var(--fg)' }}>{agency.name}</p>
            <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
              {tv
                ? online
                  ? 'TV Info Obligatorii — Online'
                  : tv.last_seen_at
                    ? `Ultima dată: ${new Date(tv.last_seen_at + 'Z').toLocaleString('ro-RO')}`
                    : 'TV Info Obligatorii — Niciodată conectat'
                : 'Niciun TV Info Obligatorii configurat'}
            </p>
          </div>
        </div>
        {tv && (
          <button
            onClick={handleToggle}
            disabled={toggling || !online}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={tvMode
              ? { background: 'var(--chip-on-bg)', color: 'var(--chip-on-fg)' }
              : { background: 'var(--surface-2)', color: 'var(--fg-2)' }
            }
          >
            {toggling ? '...' : tvMode ? 'Info activ' : 'Info inactiv'}
          </button>
        )}
      </div>

      {/* Body — documente */}
      <div className="p-5 grid grid-cols-2 gap-6">

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Documente statice</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>Afișate simultan pe jumătatea stângă</p>
            </div>
          </div>
          {staticDocs.length > 0
            ? <DocList
                docs={staticDocs}
                agencyId={agency.id}
                onDelete={handleDelete}
                onReorder={newStatic => setDocs(prev => [...newStatic, ...prev.filter(d => d.side === 'rotativ')])}
              />
            : <p className="text-xs italic mb-2" style={{ color: 'var(--fg-3)' }}>Niciun document</p>
          }
          <div className="mt-2">
            <UploadButton agencyId={agency.id} side="static" onUploaded={handleUploaded} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Documente rotative</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>Rotație pagină cu pagină pe dreapta</p>
            </div>
          </div>
          {rotativDocs.length > 0
            ? <DocList
                docs={rotativDocs}
                agencyId={agency.id}
                onDelete={handleDelete}
                onReorder={newRotativ => setDocs(prev => [...prev.filter(d => d.side === 'static'), ...newRotativ])}
              />
            : <p className="text-xs italic mb-2" style={{ color: 'var(--fg-3)' }}>Niciun document</p>
          }
          <div className="mt-2">
            <UploadButton agencyId={agency.id} side="rotativ" onUploaded={handleUploaded} />
          </div>
        </div>
      </div>

      {/* Footer — setări */}
      <div className="px-5 py-4 flex flex-wrap items-end gap-4" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--fg-2)' }}>Interval rotație (secunde)</label>
          <input
            type="number" min="1" max="300"
            value={rotationSec}
            onChange={e => setRotationSec(Number(e.target.value))}
            className="w-24 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--fg-2)' }}>Ora pornire</label>
          <input
            type="time"
            value={onTime}
            onChange={e => setOnTime(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--fg-2)' }}>Ora oprire</label>
          <input
            type="time"
            value={offTime}
            onChange={e => setOffTime(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
          />
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {savingSettings ? 'Se salvează...' : 'Salvează'}
        </button>
      </div>
    </div>
  )
}

export default function InfoObligatorii() {
  const [agencies, setAgencies] = useState([])
  const [infoTVs, setInfoTVs] = useState([])
  const [docsMap, setDocsMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [agenciesData, tvsData] = await Promise.all([getAgencies(), getInfoTVs()])
      setAgencies(agenciesData)
      const infoOnly = tvsData.filter(t => t.label.toLowerCase() === 'tv info obligatorii')
      setInfoTVs(infoOnly)

      const map = {}
      await Promise.all(
        agenciesData.map(async agency => {
          try {
            map[agency.id] = await getInfoDocs(agency.id)
          } catch {
            map[agency.id] = { docs: [], rotation_seconds: 5, on_time: null, off_time: null }
          }
        })
      )
      setDocsMap(map)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p style={{ color: 'var(--fg-3)' }}>Se încarcă...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fg)' }}>Info Obligatorii</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-3)' }}>
          Documente afișate pe TV-urile Info Obligatorii din agenții
        </p>
      </div>

      <div className="space-y-4">
        {agencies.map(agency => {
          const tv = infoTVs.find(t => t.agency_id === agency.id)
          return (
            <AgencyCard
              key={agency.id}
              agency={agency}
              tv={tv}
              initialData={docsMap[agency.id]}
            />
          )
        })}
      </div>
    </div>
  )
}
