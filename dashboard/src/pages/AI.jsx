import { useState, useEffect, useRef } from 'react'
import { aiChat, aiAnomalies } from '../api'

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const IconBot = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
)

const SEVERITY_STYLE = {
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

const SEVERITY_DOT = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

const QUICK_QUESTIONS = [
  'Câte TV-uri sunt online acum?',
  'Ce TV-uri au fost offline azi?',
  'Ce s-a redat cel mai mult ieri?',
  'Există TV-uri cu probleme?',
]

export default function AI() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bună! Sunt asistentul AI al DisplayIQ. Te pot ajuta cu informații despre TV-uri, agenții, redări și anomalii. Ce vrei să știi?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesLoading, setAnomaliesLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const history = newMessages.slice(1, -1)
      const { reply } = await aiChat(msg, history)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Eroare: ${e.response?.data?.error || e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const loadAnomalies = async () => {
    setAnomaliesLoading(true)
    try {
      const data = await aiAnomalies()
      setAnomalies(data)
    } catch (e) {
      setAnomalies({ anomalies: [], error: e.message })
    } finally {
      setAnomaliesLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Asistent AI</h2>
          <p className="text-sm text-gray-500 mt-0.5">Întreabă despre TV-uri, agenții, redări și anomalii</p>
        </div>
        <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2.5 py-1 rounded-full">Claude Haiku</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 flex flex-col" style={{ height: '520px' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                    <IconBot />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <IconBot />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => send(q)} disabled={loading}
                className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100">
            <form onSubmit={e => { e.preventDefault(); send() }} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Întreabă ceva despre sistemul tău..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium disabled:opacity-40 transition-colors">
                <IconSend />
              </button>
            </form>
          </div>
        </div>

        {/* Anomalii */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col" style={{ height: '520px' }}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Detectare anomalii</h3>
            <button onClick={loadAnomalies} disabled={anomaliesLoading}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 transition-colors">
              {anomaliesLoading ? 'Analizez...' : 'Analizează'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!anomalies && !anomaliesLoading && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-sm text-gray-500">Apasă "Analizează" pentru a detecta anomalii în comportamentul TV-urilor</p>
              </div>
            )}
            {anomaliesLoading && (
              <div className="text-center py-12 text-sm text-gray-500">
                <p className="text-3xl mb-3 animate-pulse">🤖</p>
                <p>Analizez datele...</p>
              </div>
            )}
            {anomalies && !anomaliesLoading && (
              <div className="space-y-3">
                {anomalies.anomalies.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm text-green-700 font-medium">Nicio anomalie detectată</p>
                    <p className="text-xs text-gray-500 mt-1">Toate TV-urile funcționează normal</p>
                  </div>
                )}
                {anomalies.anomalies.map((a, i) => (
                  <div key={i} className={`border rounded-xl p-3 text-sm ${SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.info}`}>
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[a.severity] || SEVERITY_DOT.info}`} />
                      <p className="leading-relaxed">{a.message}</p>
                    </div>
                  </div>
                ))}
                {anomalies.generated_at && (
                  <p className="text-xs text-gray-400 text-right">
                    Generat: {new Date(anomalies.generated_at).toLocaleTimeString('ro-RO')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
