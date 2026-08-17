import { useEffect, useRef, useState, useMemo } from 'react'

const SERVER = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:4000`
const AGENCY_ID = new URLSearchParams(window.location.search).get('agencyId') || '1'

// pdfjs încărcat dinamic din CDN — evită incompatibilitatea cu Vite 8/Rolldown
const PDFJS_CDN = 'https://unpkg.com/pdfjs-dist@6.2.108/build'
let _pdfjsLib = null
async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib
  const lib = await import(/* @vite-ignore */ `${PDFJS_CDN}/pdf.min.mjs`)
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`
  _pdfjsLib = lib
  return lib
}

function docsSig(docs) {
  return docs.map(d => `${d.id}:${d.side}:${d.position}:${d.filename}`).join('|')
}

// Cache PDF instances so each file is fetched and parsed only once
const pdfCache = new Map()

async function loadPdf(url) {
  if (pdfCache.has(url)) return pdfCache.get(url)
  const lib = await getPdfjs()
  // Facem fetch ourselves (same-origin) → trimitem ArrayBuffer la pdfjs
  // Evită mixed-content blocaj când pdfjs worker vine de pe CDN (https)
  const resp = await fetch(url)
  const data = await resp.arrayBuffer()
  const pdf = await lib.getDocument({ data }).promise
  pdfCache.set(url, pdf)
  return pdf
}

function PdfCanvas({ url, pageNum }) {
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
        // Așteaptă ca browser-ul să calculeze dimensiunile containerului
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (cancelled) return
        const w = container.clientWidth || 400
        const h = container.clientHeight || 500
        const vp = page.getViewport({ scale: 1 })
        const scale = Math.min(w / vp.width, h / vp.height) * 0.97
        const scaled = page.getViewport({ scale })
        canvas.width = scaled.width
        canvas.height = scaled.height
        const ctx = canvas.getContext('2d')
        await page.render({ canvasContext: ctx, viewport: scaled }).promise
      } catch (e) {
        console.error('[InfoDisplay] PDF render error:', url, e)
      }
    }
    render()
    return () => { cancelled = true }
  }, [url, pageNum])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  )
}

export default function InfoDisplay({ docs = [], rotationSeconds = 5, powered = true, onDocsUpdate }) {
  const staticDocs = useMemo(() => docs.filter(d => d.side === 'static'), [docs])
  const rotativDocs = useMemo(() => docs.filter(d => d.side === 'rotativ'), [docs])

  // Ref so the nightly timeout can read current docs without stale closure
  const docsRef = useRef(docs)
  useEffect(() => { docsRef.current = docs }, [docs])

  // La 02:00 — verifică dacă s-au schimbat doc-urile; actualizează doar dacă sunt diferențe
  useEffect(() => {
    let timerId = null
    const scheduleCheck = () => {
      const now = new Date()
      const next2am = new Date()
      next2am.setHours(2, 0, 0, 0)
      if (next2am <= now) next2am.setDate(next2am.getDate() + 1)
      timerId = setTimeout(async () => {
        try {
          const res = await fetch(`${SERVER}/api/info/public/${AGENCY_ID}`)
          if (res.ok) {
            const data = await res.json()
            const newDocs = data.docs || []
            const newRotSec = data.rotation_seconds ?? 5
            if (docsSig(newDocs) !== docsSig(docsRef.current)) {
              onDocsUpdate?.(newDocs, newRotSec)
            }
          }
        } catch {}
        scheduleCheck()
      }, next2am - now)
    }
    scheduleCheck()
    return () => clearTimeout(timerId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [pageCounts, setPageCounts] = useState({})
  const pageCountsRef = useRef({})
  const [rot, setRot] = useState({ docIdx: 0, pageIdx: 1 })

  // Keep ref in sync with state so the interval can read it without stale closure
  useEffect(() => { pageCountsRef.current = pageCounts }, [pageCounts])

  // Load PDF page counts for rotative docs
  useEffect(() => {
    rotativDocs.forEach(doc => {
      const url = `${SERVER}/api/info/file/${doc.filename}`
      if (pageCountsRef.current[doc.filename] !== undefined) return
      loadPdf(url).then(pdf => {
        setPageCounts(prev => ({ ...prev, [doc.filename]: pdf.numPages }))
      }).catch(() => {})
    })
  }, [rotativDocs])

  // Reset rotation index when the list of rotative docs changes
  useEffect(() => {
    setRot({ docIdx: 0, pageIdx: 1 })
  }, [rotativDocs.length])

  // Advance page/doc on each tick
  useEffect(() => {
    if (rotativDocs.length === 0) return
    const timer = setInterval(() => {
      setRot(prev => {
        const doc = rotativDocs[prev.docIdx % rotativDocs.length]
        const totalPages = pageCountsRef.current[doc?.filename] || 1
        if (prev.pageIdx >= totalPages) {
          return { docIdx: (prev.docIdx + 1) % rotativDocs.length, pageIdx: 1 }
        }
        return { ...prev, pageIdx: prev.pageIdx + 1 }
      })
    }, rotationSeconds * 1000)
    return () => clearInterval(timer)
  }, [rotativDocs, rotationSeconds])

  const currentRotDoc = rotativDocs.length > 0
    ? rotativDocs[rot.docIdx % rotativDocs.length]
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', display: 'flex' }}>
      {/* Stânga — documente statice simultan */}
      <div style={{
        width: '50%',
        height: '100%',
        padding: '10px',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridAutoRows: '1fr',
        gap: '8px',
      }}>
        {staticDocs.map(doc => (
          <div key={doc.id} style={{ background: 'white', borderRadius: '4px', overflow: 'hidden' }}>
            <PdfCanvas
              url={`${SERVER}/api/info/file/${doc.filename}`}
              pageNum={1}
            />
          </div>
        ))}
      </div>

      {/* Separator */}
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* Dreapta — document rotativ */}
      <div style={{
        width: '50%',
        height: '100%',
        padding: '10px',
        boxSizing: 'border-box',
        background: 'white',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        {currentRotDoc && (
          <PdfCanvas
            key={`${currentRotDoc.filename}-p${rot.pageIdx}`}
            url={`${SERVER}/api/info/file/${currentRotDoc.filename}`}
            pageNum={rot.pageIdx}
          />
        )}
      </div>

      {/* Overlay ecran oprit */}
      {!powered && (
        <div style={{ position: 'absolute', inset: 0, background: 'black', zIndex: 9999 }} />
      )}
    </div>
  )
}
