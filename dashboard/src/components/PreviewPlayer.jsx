import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { mediaUrl, getRates, getForexRates, getInfoDocs } from '../api'

// pdfjs — same approach as InfoDisplay in player
const PDFJS_CDN = 'https://unpkg.com/pdfjs-dist@6.2.108/build'
let _pdfjsLib = null
async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib
  const lib = await import(/* @vite-ignore */ `${PDFJS_CDN}/pdf.min.mjs`)
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`
  _pdfjsLib = lib
  return lib
}
const pdfCache = new Map()
async function loadPdf(url) {
  if (pdfCache.has(url)) return pdfCache.get(url)
  const lib = await getPdfjs()
  const resp = await fetch(url)
  const data = await resp.arrayBuffer()
  const pdf = await lib.getDocument({ data, wasmUrl: 'https://unpkg.com/pdfjs-dist@6.2.108/wasm/' }).promise
  pdfCache.set(url, pdf)
  return pdf
}
function PdfCanvas({ url, pageNum, fit = 'cover' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try {
        const pdf = await loadPdf(url)
        if (cancelled) return
        const page = await pdf.getPage(pageNum)
        if (cancelled) return
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (cancelled) return
        const w = container.clientWidth || 400
        const h = container.clientHeight || 500
        const vp = page.getViewport({ scale: 1, rotation: page.rotate })
        const scale = fit === 'contain' ? Math.min(w / vp.width, h / vp.height) : Math.max(w / vp.width, h / vp.height)
        const scaled = page.getViewport({ scale, rotation: page.rotate })
        if (fit === 'contain') { canvas.width = scaled.width; canvas.height = scaled.height }
        else { canvas.width = w; canvas.height = h }
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise
      } catch {}
    }
    render()
    return () => { cancelled = true }
  }, [url, pageNum, fit])
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'white' }}>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  )
}

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']
const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

function formatLastUpdate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} ▪ ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function Ticker({ rates, updatedAt }) {
  if (!rates) return null

  const lastUpdate = formatLastUpdate(updatedAt)

  const s = {
    wrap: {
      background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'system-ui, -apple-system, sans-serif', flexShrink: 0,
      display: 'flex',
    },
    rows: { flex: 1, overflow: 'hidden' },
    row: (bg) => ({
      display: 'flex', alignItems: 'center', padding: '7px 20px',
      background: bg,
      borderBottom: bg === '#fff' ? '1px solid rgba(0,0,0,0.06)' : 'none',
    }),
    label: (color) => ({ fontSize: 11, fontWeight: 600, color, width: 72, flexShrink: 0, letterSpacing: '0.05em' }),
    cell: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderLeft: '1px solid rgba(0,0,0,0.06)' },
    cur: { fontSize: 12, fontWeight: 600, color: '#374151', width: 26 },
    tag: { fontSize: 10, color: '#9ca3af' },
    val: () => ({ fontSize: 15, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }),
    dash: { fontSize: 15, color: '#d1d5db' },
  }

  return (
    <div style={s.wrap}>
      <div style={s.rows}>
        <div style={s.row('#fff')}>
          <span style={{ ...s.label('#16a34a'), fontSize: 13 }}>CEC BANK</span>
          {CURRENCIES.map(c => {
            const r = rates[c]
            const hasBuySell = r?.buy != null || r?.sell != null
            return (
              <div key={c} style={s.cell}>
                <span style={s.cur}>{c}</span>
                {hasBuySell ? (
                  <>
                    <span style={s.tag}>cmp</span>
                    <span style={s.val('#0F6E56')}>{r.buy?.toFixed(4) ?? '—'}</span>
                    <span style={{ fontSize: 12, color: '#d1d5db' }}>/</span>
                    <span style={s.tag}>vnd</span>
                    <span style={s.val('#993C1D')}>{r.sell?.toFixed(4) ?? '—'}</span>
                  </>
                ) : (
                  <span style={s.dash}>—</span>
                )}
              </div>
            )
          })}
          {lastUpdate && (
            <div style={{ marginLeft: 'auto', paddingLeft: 16, borderLeft: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                Ultima actualizare: {lastUpdate}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FOREX_META = {
  EUR: { name: 'Euro' }, USD: { name: 'Dolar SUA' }, CHF: { name: 'Franc elvețian' },
  GBP: { name: 'Liră sterlină' }, CAD: { name: 'Dolar canadian' }, DKK: { name: 'Coroană daneză' },
  HUF: { name: 'Forint maghiar' }, PLN: { name: 'Zlot polonez' }, SEK: { name: 'Coroană suedeză' },
}
const FOREX_MAIN = ['EUR', 'USD', 'CHF', 'GBP']
const FOREX_SECONDARY = ['CAD', 'DKK', 'HUF', 'PLN', 'SEK']
function formatForexDate(str) {
  if (!str) return ''
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2})/)
  if (!m) return str
  return `${m[4]} · ${parseInt(m[1])} ${MONTHS[parseInt(m[2]) - 1]} ${m[3]}`
}

function ForexScreen({ rates, updatedAt }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0d1f14', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 28px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, gap: 14 }}>
        <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>CEC BANK</span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, letterSpacing: 2, fontWeight: 600 }}>CURSURI DE SCHIMB VALUTAR</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '6px 28px 4px', flexShrink: 0 }}>
          {['VALUTĂ','CUMPĂRĂM','VINDEM'].map((h, i) => (
            <span key={h} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textAlign: i === 0 ? 'left' : 'center' }}>{h}</span>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {FOREX_MAIN.map((code, idx) => {
            const r = rates?.[code]; const hasBuy = r?.buy != null; const hasSell = r?.sell != null
            return (
              <div key={code} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '8px 28px', borderBottom: idx < FOREX_MAIN.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', alignItems: 'center', background: idx === 0 ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{FOREX_META[code].name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: 1, marginTop: 1 }}>{code}</div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 800, color: hasBuy ? '#2ecc71' : 'rgba(255,255,255,0.2)', fontSize: 16 }}>{hasBuy ? r.buy.toFixed(4) : '—'}</div>
                <div style={{ textAlign: 'center', fontWeight: 800, color: hasSell ? '#e67e22' : 'rgba(255,255,255,0.2)', fontSize: 16 }}>{hasSell ? r.sell.toFixed(4) : '—'}</div>
              </div>
            )
          })}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '3px 0', flexShrink: 0 }}>
          {FOREX_SECONDARY.map((code, idx) => {
            const r = rates?.[code]; const hasBuy = r?.buy != null; const hasSell = r?.sell != null
            return (
              <div key={code} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '2px 28px', borderBottom: idx < FOREX_SECONDARY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 9 }}>{FOREX_META[code].name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 7.5, letterSpacing: 0.5 }}>{code}</div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, color: hasBuy ? 'rgba(46,204,113,0.7)' : 'rgba(255,255,255,0.15)', fontSize: 10 }}>{hasBuy ? r.buy.toFixed(4) : '—'}</div>
                <div style={{ textAlign: 'center', fontWeight: 700, color: hasSell ? 'rgba(230,126,34,0.7)' : 'rgba(255,255,255,0.15)', fontSize: 10 }}>{hasSell ? r.sell.toFixed(4) : '—'}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)', flexShrink: 0, padding: '6px 28px 8px' }}>
        {updatedAt && (
          <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
            Ultima actualizare: {formatForexDate(updatedAt)}
          </div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 7, lineHeight: 1.5 }}>
          <div>Cursurile CEC Bank se pot modifica de mai multe ori pe parcursul unei zile, în funcție de mișcările pieței valutare interbancare.</div>
          <div>În cazul schimburilor valutare inițiate online, de persoane fizice, se aplică cursul valutar mai avantajos, valabil pe Internet și Mobile Banking.</div>
        </div>
      </div>
    </div>
  )
}

function ForexPreview({ portrait, onClose }) {
  const [data, setData] = useState(null)
  useEffect(() => { getForexRates().then(r => setData(r)).catch(() => {}) }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden', minHeight: 0 }}>
        <div style={{
          background: '#242424',
          borderRadius: portrait ? 28 : 18,
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.12)',
          flexShrink: 0, position: 'relative',
          ...(portrait ? { height: 'min(calc(100vh - 124px), 680px)', aspectRatio: '9/16' }
            : { width: 'min(100%, 940px, calc((100vh - 124px) * 16 / 9))', aspectRatio: '16/9' }),
        }}>
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, bottom: portrait ? 42 : 52, borderRadius: portrait ? 14 : 8, overflow: 'hidden' }}>
            {!data
              ? <div style={{ position: 'absolute', inset: 0, background: '#0d1f14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif' }}>Se încarcă cursurile...</span>
                </div>
              : <ForexScreen rates={data.rates ?? data} updatedAt={data.updatedAt} />
            }
          </div>
        </div>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.9)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="text-white/60 hover:text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg">ESC / Închide</button>
      </div>
    </div>
  )
}

function InfoPreview({ agencyId, portrait, onClose }) {
  const [data, setData] = useState(null)
  const [rotDocIdx, setRotDocIdx] = useState(0)
  const [rotPageNum, setRotPageNum] = useState(1)
  const [pageCounts, setPageCounts] = useState({})

  useEffect(() => { getInfoDocs(agencyId).then(r => setData(r)).catch(() => setData({ docs: [], rotation_seconds: 10 })) }, [agencyId])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const staticDocs = data?.docs?.filter(d => d.side === 'static') ?? []
  const rotDocs = data?.docs?.filter(d => d.side === 'rotativ') ?? []
  const rotSec = data?.rotation_seconds ?? 10

  // Pre-load page counts for all rotative docs
  useEffect(() => {
    if (!rotDocs.length) return
    rotDocs.forEach(doc => {
      const url = `/api/info/file/${doc.filename}`
      if (pageCounts[doc.filename] !== undefined) return
      loadPdf(url).then(pdf => {
        setPageCounts(prev => ({ ...prev, [doc.filename]: pdf.numPages }))
      }).catch(() => {
        setPageCounts(prev => ({ ...prev, [doc.filename]: 1 }))
      })
    })
  }, [rotDocs.length])

  // Cycle page by page across rotative docs
  useEffect(() => {
    if (!rotDocs.length) return
    const t = setInterval(() => {
      setRotPageNum(prevPage => {
        const curDoc = rotDocs[rotDocIdx]
        const total = curDoc ? (pageCounts[curDoc.filename] ?? 1) : 1
        if (prevPage < total) return prevPage + 1
        // advance to next doc
        setRotDocIdx(prevDocIdx => (prevDocIdx + 1) % rotDocs.length)
        return 1
      })
    }, rotSec * 1000)
    return () => clearInterval(t)
  }, [rotDocs.length, rotDocIdx, rotSec, pageCounts])

  const curRotDoc = rotDocs[rotDocIdx]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden', minHeight: 0 }}>
        <div style={{
          background: '#242424',
          borderRadius: portrait ? 28 : 18,
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.12)',
          flexShrink: 0, position: 'relative',
          ...(portrait ? { height: 'min(calc(100vh - 124px), 680px)', aspectRatio: '9/16' }
            : { width: 'min(100%, 940px, calc((100vh - 124px) * 16 / 9))', aspectRatio: '16/9' }),
        }}>
          {/* Screen — split: stânga=statice (grid 2col), dreapta=rotativ */}
          <div style={{ position: 'absolute', top: 14, left: 14, right: 14, bottom: portrait ? 42 : 52, background: '#f5f5f5', borderRadius: portrait ? 14 : 8, overflow: 'hidden', display: 'flex' }}>
            {!data ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#9ca3af', fontFamily: 'sans-serif' }}>Se încarcă...</p>
              </div>
            ) : (
              <>
                {/* Stânga — TOATE staticele, grid 2 coloane, pagina 1 din fiecare */}
                <div style={{ flex: 1, borderRight: '2px solid #e5e7eb', overflow: 'hidden', padding: 8, background: '#fff',
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '1fr', gap: 8 }}>
                  {staticDocs.length === 0
                    ? <p style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'sans-serif', gridColumn: '1 / -1', alignSelf: 'center', textAlign: 'center' }}>Niciun doc static</p>
                    : staticDocs.map((doc, i) => (
                      <div key={doc.filename} style={{
                        overflow: 'hidden',
                        gridColumn: (staticDocs.length % 2 !== 0 && i === staticDocs.length - 1) ? '1 / -1' : undefined
                      }}>
                        <PdfCanvas url={`/api/info/file/${doc.filename}`} pageNum={1} fit="contain" />
                      </div>
                    ))
                  }
                </div>
                {/* Dreapta — doc rotativ curent, pagina curentă */}
                <div style={{ flex: 1, overflow: 'hidden', background: '#fff' }}>
                  {curRotDoc
                    ? <PdfCanvas key={`${curRotDoc.filename}-${rotPageNum}`} url={`/api/info/file/${curRotDoc.filename}`} pageNum={rotPageNum} fit="contain" />
                    : <p style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'sans-serif', textAlign: 'center', padding: 8 }}>Niciun doc rotativ</p>
                  }
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.9)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {curRotDoc && (
          <span className="text-white/50 text-xs">
            Rotativ: doc {rotDocIdx + 1}/{rotDocs.length} · pagina {rotPageNum}/{pageCounts[curRotDoc.filename] ?? '?'} · {rotSec}s
          </span>
        )}
        <div className="flex-1" />
        <button onClick={onClose} className="text-white/60 hover:text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg">ESC / Închide</button>
      </div>
    </div>
  )
}

export default function PreviewPlayer({ items, onClose, portrait: initialPortrait = false, mode = 'playlist', agencyId }) {
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [playing, setPlaying] = useState(true)
  const [ratesData, setRatesData] = useState(null)
  const [portrait, setPortrait] = useState(!!initialPortrait)
  const videoRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    getRates().then(data => { if (data?.rates) setRatesData(data) }).catch(() => {})
  }, [])

  // Early return for special TV modes
  if (mode === 'forex') return <ForexPreview portrait={!!initialPortrait} onClose={onClose} />
  if (mode === 'info') return <InfoPreview agencyId={agencyId} portrait={!!initialPortrait} onClose={onClose} />

  const item = items[current]

  const goNext = useCallback(() => {
    clearInterval(timerRef.current)
    setCurrent(prev => (prev + 1) % items.length)
  }, [items.length])

  const goPrev = () => {
    clearInterval(timerRef.current)
    setCurrent(prev => (prev - 1 + items.length) % items.length)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!item) return
    if (item.type === 'image' && playing) {
      const secs = item.display_duration_seconds ?? 10
      setTimeLeft(secs)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); goNext(); return 0 }
          return prev - 1
        })
      }, 1000)
    } else {
      setTimeLeft(null)
    }
    return () => clearInterval(timerRef.current)
  }, [current, playing, goNext])

  useEffect(() => {
    if (!videoRef.current) return
    if (playing) videoRef.current.play().catch(() => {})
    else videoRef.current.pause()
  }, [playing, current])

  const togglePlay = () => {
    setPlaying(p => {
      if (item.type === 'image' && p) clearInterval(timerRef.current)
      return !p
    })
  }

  if (!item) return null

  const mediaStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>

      {/* TV frame area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden', minHeight: 0 }}>

        {/* TV shell — position:relative so screen can be absolute inside */}
        <div style={{
          background: '#242424',
          borderRadius: portrait ? 28 : 18,
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.12)',
          flexShrink: 0,
          position: 'relative',
          // Portrait: constrain by height, width follows from 9:16
          // Landscape: constrain by BOTH width and height to fit the popup window
          ...(portrait ? {
            height: 'min(calc(100vh - 124px), 680px)',
            aspectRatio: '9/16',
          } : {
            width: 'min(100%, 940px, calc((100vh - 124px) * 16 / 9))',
            aspectRatio: '16/9',
          }),
        }}>

          {/* Screen — inset from shell edges = bezel thickness */}
          <div style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            bottom: portrait ? 42 : 14,
            background: '#000',
            borderRadius: portrait ? 14 : 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {item.type === 'video' ? (
              <video ref={videoRef} key={`${current}-${item.filename}`} src={mediaUrl(item.filename)}
                autoPlay={playing} onEnded={goNext} style={mediaStyle} />
            ) : (
              <img key={`${current}-${item.filename}`} src={mediaUrl(item.filename)} alt={item.original_name} style={mediaStyle} />
            )}

            {/* Preview badge */}
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              Preview · {current + 1}/{items.length}
            </div>

            {item.type === 'image' && timeLeft !== null && (
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 999 }}>
                {timeLeft}s
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div style={{ background: 'rgba(0,0,0,0.9)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={goPrev} className="text-white hover:text-blue-400 text-xl px-2">⏮</button>
        <button onClick={togglePlay} className="text-white hover:text-blue-400 text-2xl px-2">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={goNext} className="text-white hover:text-blue-400 text-xl px-2">⏭</button>
        <button onClick={() => setPortrait(p => !p)}
          style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: portrait ? 'rgba(124,58,237,0.4)' : 'transparent', color: portrait ? '#c4b5fd' : 'rgba(255,255,255,0.5)', cursor: 'pointer', letterSpacing: '0.05em' }}>
          {portrait ? 'PORT.' : 'LAND.'}
        </button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
          {items.map((it, i) => (
            <button key={i} onClick={() => { clearInterval(timerRef.current); setCurrent(i) }}
              className={`shrink-0 text-xs px-2 py-1 rounded transition-colors
                ${i === current ? 'bg-blue-600 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}>
              {it.type === 'video' ? '🎬' : '🖼️'} {i + 1}
            </button>
          ))}
        </div>

        <span className="text-white/60 text-xs truncate max-w-48">{item.original_name}</span>

        <button onClick={onClose}
          className="text-white/60 hover:text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg ml-2">
          ESC / Închide
        </button>
      </div>
    </div>
  )
}
