import { useCallback, useEffect, useRef, useState } from '@lynx-js/react'
import type { NeedleAgent, NeedleRunResult } from 'lynx-needle'
import { loadNeedle } from 'lynx-needle'
import {
  DEMO_HANDLERS,
  DEMO_SYSTEM,
  DEMO_TOOLS,
  EXTRACT_DEMO_SCHEMA,
  EXTRACT_DEMO_TEXT,
  PRESET_QUERIES,
} from './tools.js'
import './App.css'

type Entry =
  | { kind: 'user'; text: string }
  | { kind: 'turn'; response: NeedleRunResult }
  | { kind: 'extract'; output: Record<string, unknown> | null }
  | { kind: 'error'; text: string }

const CAPABILITIES = [
  { icon: '⚡', title: 'Agent loop', desc: 'model decides, JS executes' },
  { icon: '🛡', title: 'Schema-safe', desc: 'args always match schema' },
  { icon: '🎯', title: 'Calibrated', desc: 'confidence you can gate on' },
  { icon: '🚫', title: 'Refusal', desc: 'no hallucinated calls' },
  { icon: '📄', title: 'Extraction', desc: 'text → typed objects' },
  { icon: '📴', title: 'On-device', desc: 'zero network at inference' },
]

function confidenceTier(value: number): 'high' | 'mid' | 'low' {
  if (value >= 0.8) return 'high'
  if (value >= 0.5) return 'mid'
  return 'low'
}

function ConfidencePill({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null
  const tier = confidenceTier(value)
  return (
    <view className={`pill pill-${tier}`}>
      <view className="pill-dot" />
      <text className="pill-text">confidence {(value * 100).toFixed(0)}%</text>
    </view>
  )
}

function TypePill({ response }: { response: NeedleRunResult }) {
  const refused =
    response.type === 'call' && (response.function_calls?.length ?? 0) === 0
  const kind = refused ? 'refused' : response.type === 'call' ? 'call' : 'respond'
  const label =
    kind === 'refused' ? 'refused · off-topic' : kind === 'call' ? 'tool call' : 'respond'
  return (
    <view className={`pill pill-type-${kind}`}>
      <text className="pill-text">{label}</text>
    </view>
  )
}

function TurnCard({ response }: { response: NeedleRunResult }) {
  return (
    <view className="card" flatten={false}>
      <view className="card-head">
        <TypePill response={response} />
        <ConfidencePill value={response.confidence} />
      </view>

      {(response.function_calls ?? []).map((call, i) => (
        <view key={i} className="codeblock">
          <text className="codeblock-name">⚙ {call.name}</text>
          <text className="codeblock-args">
            {JSON.stringify(call.arguments, null, 2)}
          </text>
        </view>
      ))}

      {response.results.length > 0 && (
        <view className="result-block">
          <text className="result-label">↳ handler result</text>
          <text className="codeblock-args">
            {JSON.stringify(response.results, null, 2)}
          </text>
        </view>
      )}

      {response.reasoning ? (
        <text className="reasoning">{response.reasoning}</text>
      ) : null}

      <view className="perf-row">
        <text className="perf-line">
          ⚡ {response.prefill_tps?.toFixed(0) ?? '-'} t/s · ⏱{' '}
          {response.decode_tps?.toFixed(0) ?? '-'} t/s · 🧠{' '}
          {response.peak_ram_mb?.toFixed(0) ?? '-'} MB
        </text>
      </view>
    </view>
  )
}

function ExtractCard({ output }: { output: Record<string, unknown> | null }) {
  return (
    <view className="card card-extract" flatten={false}>
      <view className="card-head">
        <view className="pill pill-extract">
          <text className="pill-text">📄 extraction</text>
        </view>
      </view>
      <view className="kv-table">
        {output === null ? (
          <text className="dim">no structured output</text>
        ) : (
          Object.entries(output).map(([k, v], i, arr) => (
            <view key={k} className={i === arr.length - 1 ? 'kv-row kv-row-last' : 'kv-row'}>
              <text className="kv-key">{k}</text>
              <text className="kv-value">{String(v)}</text>
            </view>
          ))
        )}
      </view>
    </view>
  )
}

function Welcome() {
  return (
    <view className="welcome" flatten={false}>
      <text className="welcome-title">Talk to your phone.{'\n'}It calls the tools.</text>
      <text className="welcome-sub">
        A 45M-parameter, 2-bit model running entirely on this device. Declare
        tools in JSON Schema; needle returns structured calls with calibrated
        confidence.
      </text>
      <view className="cap-grid">
        {CAPABILITIES.map((c, i) => (
          <view key={c.title} className={i % 2 === 1 ? 'cap-item cap-item-right' : 'cap-item'}>
            <text className="cap-icon">{c.icon}</text>
            <view className="cap-texts">
              <text className="cap-title">{c.title}</text>
              <text className="cap-desc">{c.desc}</text>
            </view>
          </view>
        ))}
      </view>
      <text className="welcome-hint">Try a preset below ↓</text>
    </view>
  )
}

export function App() {
  const needleRef = useRef<NeedleAgent | null>(null)
  const [ready, setReady] = useState(false)
  const [engineVersion, setEngineVersion] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    loadNeedle().then((agent) => {
      needleRef.current = agent
      if (agent) {
        agent.init(DEMO_SYSTEM, DEMO_TOOLS)
        setEngineVersion(agent.engineVersion())
        setReady(true)
      }
    })
  }, [])

  const logRef = useRef<any>(null)
  const scrollTargetRef = useRef<number | null>(null)
  // setBusy is async; a ref closes the double-tap window.
  const busyRef = useRef(false)

  const push = useCallback((entry: Entry) => {
    setEntries((prev) => {
      // The 'user' entry marks the start of a turn (extract turns included);
      // scroll targets it so the response/extract card follows below.
      if (entry.kind === 'user') scrollTargetRef.current = prev.length
      return [...prev, entry]
    })
  }, [])

  // Scroll the log so the start of the latest turn is visible.
  useEffect(() => {
    if (entries.length === 0) return
    const target = scrollTargetRef.current
    const index = target ?? entries.length - 1
    const t = setTimeout(() => {
      logRef.current
        ?.invoke({ method: 'scrollTo', params: { index, offset: 0, smooth: true } })
        .exec()
    }, 80)
    return () => clearTimeout(t)
  }, [entries, busy])

  const ask = useCallback(
    async (query: string) => {
      const agent = needleRef.current
      if (!agent || busy || busyRef.current || !query.trim()) return
      busyRef.current = true
      setBusy(true)
      push({ kind: 'user', text: query })
      setDraft('')
      try {
        const response = await agent.run(query, DEMO_HANDLERS)
        push({ kind: 'turn', response })
      } catch (err) {
        push({ kind: 'error', text: String(err instanceof Error ? err.message : err) })
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [busy, push],
  )

  const runExtract = useCallback(async () => {
    const agent = needleRef.current
    if (!agent || busy || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      // Show the input as a user bubble so extraction follows the same
      // conversation pattern as tool-calling turns.
      push({ kind: 'user', text: `extract: ${EXTRACT_DEMO_TEXT}` })
      const output = await agent.extract(EXTRACT_DEMO_TEXT, EXTRACT_DEMO_SCHEMA)
      push({ kind: 'extract', output })
      // extract() re-inits the session with a single tool; restore the demo set.
      agent.init(DEMO_SYSTEM, DEMO_TOOLS)
    } catch (err) {
      push({ kind: 'error', text: String(err instanceof Error ? err.message : err) })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [busy, push])

  if (!ready) {
    return (
      <view className="page">
        <view className="setup-card">
          <text className="setup-tag">addon not available</text>
          <text className="setup-text">
            The needle NAPI addon is not loaded. To run this demo:{'\n\n'}
            1. Build the package and the platform addon in the repo root.
            {'\n'}
            2. Android: apply the Lynx library plugins and call
            LynxAutolinkGenerated.setupGlobal after LynxEnv.init.{'\n'}
            3. iOS: use cocoapods-lynx-library with a Lynx 4.3 nightly pod.
            {'\n'}
            4. The host must embed a Lynx runtime with NAPI binding.
          </text>
        </view>
      </view>
    )
  }

  return (
    <view className="page">
      <view className="header">
        <view className="header-row">
          <text className="logo">◆ Needle</text>
          <view className="pill pill-ready">
            <view className="pill-dot" />
            <text className="pill-text">engine {engineVersion}</text>
          </view>
        </view>
        <text className="tagline">on-device tool calling</text>
        <view className="spec-row">
          {[
            { value: '45M', label: 'params' },
            { value: '2-bit', label: 'weights' },
            { value: String(DEMO_TOOLS.length), label: 'tools live' },
            { value: '0', label: 'network' },
          ].map((s, i, arr) => (
            <view
              key={s.label}
              className={i === arr.length - 1 ? 'spec-tile spec-tile-last' : 'spec-tile'}
            >
              <text className="spec-value">{s.value}</text>
              <text className="spec-label">{s.label}</text>
            </view>
          ))}
        </view>
      </view>

      <scroll-view ref={logRef} className="log" scroll-orientation="vertical">
        {entries.length === 0 && !busy ? <Welcome /> : null}
        {entries.map((entry, i) => {
          if (entry.kind === 'user') {
            return (
              <view key={i} className="user-bubble" flatten={false}>
                <text className="user-text">{entry.text}</text>
              </view>
            )
          }
          if (entry.kind === 'turn') {
            return <TurnCard key={i} response={entry.response} />
          }
          if (entry.kind === 'extract') {
            return <ExtractCard key={i} output={entry.output} />
          }
          return (
            <view key={i} className="card" flatten={false}>
              <text className="error">{entry.text}</text>
            </view>
          )
        })}
        {busy && (
          <view className="thinking" flatten={false}>
            <text className="thinking-text">● ● ● on-device inference…</text>
          </view>
        )}
      </scroll-view>

      <scroll-view className="chips" scroll-orientation="horizontal">
        {PRESET_QUERIES.map((q) => (
          <view key={q.text} className="chip" bindtap={() => ask(q.text)}>
            <text className="chip-text">
              {q.icon} {q.text}
            </text>
          </view>
        ))}
        <view className="chip chip-extract" bindtap={runExtract}>
          <text className="chip-text chip-extract-text">📄 extract: invoice</text>
        </view>
      </scroll-view>

      <view className="input-row">
        <input
          key={`input-${entries.length}`}
          className="input"
          placeholder="ask the on-device model…"
          bindinput={(e) => setDraft(e.detail.value)}
        />
        <view
          className={`send ${busy ? 'send-disabled' : ''}`}
          bindtap={() => ask(draft)}
        >
          <text className="send-text">↑</text>
        </view>
      </view>
    </view>
  )
}
