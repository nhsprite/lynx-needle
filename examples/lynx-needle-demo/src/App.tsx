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
  | { kind: 'extract'; input: string; output: Record<string, unknown> | null }
  | { kind: 'error'; text: string }

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null
  const level = value >= 0.7 ? 'ok' : 'low'
  return (
    <text className={`badge badge-${level}`}>
      confidence {(value * 100).toFixed(0)}%
    </text>
  )
}

function TurnCard({ response }: { response: NeedleRunResult }) {
  const refused =
    response.type === 'call' && (response.function_calls?.length ?? 0) === 0
  return (
    <view className="card">
      <view className="card-row">
        <text className="tag">{refused ? 'refused (off-topic)' : response.type}</text>
        <ConfidenceBadge value={response.confidence} />
      </view>
      {(response.function_calls ?? []).map((call, i) => (
        <view key={i} className="call">
          <text className="call-name">⚙ {call.name}</text>
          <text className="mono">{JSON.stringify(call.arguments)}</text>
        </view>
      ))}
      {response.results.length > 0 && (
        <view className="results">
          <text className="mono dim">{JSON.stringify(response.results)}</text>
        </view>
      )}
      {response.reasoning ? (
        <text className="reasoning">{response.reasoning}</text>
      ) : null}
      <text className="perf">
        prefill {response.prefill_tps?.toFixed(0) ?? '-'} t/s · decode{' '}
        {response.decode_tps?.toFixed(0) ?? '-'} t/s · RAM{' '}
        {response.peak_ram_mb?.toFixed(1) ?? '-'} MB
      </text>
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

  const push = useCallback((entry: Entry) => {
    setEntries((prev) => [...prev, entry])
  }, [])

  const ask = useCallback(
    async (query: string) => {
      const agent = needleRef.current
      if (!agent || busy || !query.trim()) return
      setBusy(true)
      push({ kind: 'user', text: query })
      setDraft('')
      try {
        const response = await agent.run(query, DEMO_HANDLERS)
        push({ kind: 'turn', response })
      } catch (err) {
        push({ kind: 'error', text: String(err instanceof Error ? err.message : err) })
      } finally {
        setBusy(false)
      }
    },
    [busy, push],
  )

  const runExtract = useCallback(async () => {
    const agent = needleRef.current
    if (!agent || busy) return
    setBusy(true)
    try {
      const output = await agent.extract(EXTRACT_DEMO_TEXT, EXTRACT_DEMO_SCHEMA)
      push({ kind: 'extract', input: EXTRACT_DEMO_TEXT, output })
      // extract() re-inits the session with a single tool; restore the demo set.
      agent.init(DEMO_SYSTEM, DEMO_TOOLS)
    } catch (err) {
      push({ kind: 'error', text: String(err instanceof Error ? err.message : err) })
    } finally {
      setBusy(false)
    }
  }, [busy, push])

  if (!ready) {
    return (
      <view className="page">
        <text className="title">Needle for Lynx</text>
        <view className="card">
          <text className="tag">addon not available</text>
          <text className="mono dim">
            The needle NAPI addon is not loaded. To run this demo:{'\n\n'}
            1. Build the addon (npm run build:android / build:ios in the addon
            repo); Android artifacts land in android/src/main/jniLibs directly.
            {'\n'}
            2. Android: use android/ as a Gradle module (see
            examples/android-host).{'\n'}
            3. iOS: add pod 'needle' from ios/ (see examples/ios-host).
            {'\n'}
            4. The host must embed a Lynx runtime with NAPI binding enabled —
            the published Maven AARs compile it out.
          </text>
        </view>
      </view>
    )
  }

  return (
    <view className="page">
      <view className="header">
        <text className="title">Needle for Lynx</text>
        <text className="subtitle">
          engine {engineVersion} · {DEMO_TOOLS.length} tools · 45M params on-device
        </text>
      </view>

      <scroll-view className="log" scroll-orientation="vertical">
        {entries.map((entry, i) => {
          if (entry.kind === 'user') {
            return (
              <view key={i} className="user-bubble">
                <text className="user-text">{entry.text}</text>
              </view>
            )
          }
          if (entry.kind === 'turn') {
            return <TurnCard key={i} response={entry.response} />
          }
          if (entry.kind === 'extract') {
            return (
              <view key={i} className="card">
                <text className="tag">extract</text>
                <text className="mono dim">{entry.input}</text>
                <text className="mono">{JSON.stringify(entry.output)}</text>
              </view>
            )
          }
          return (
            <view key={i} className="card">
              <text className="error">{entry.text}</text>
            </view>
          )
        })}
        {busy && <text className="dim pad">thinking…</text>}
      </scroll-view>

      <scroll-view className="chips" scroll-orientation="horizontal">
        {PRESET_QUERIES.map((q) => (
          <text key={q} className="chip" bindtap={() => ask(q)}>
            {q}
          </text>
        ))}
        <text className="chip chip-extract" bindtap={runExtract}>
          extract: invoice
        </text>
      </scroll-view>

      <view className="input-row">
        <input
          key={`input-${entries.length}`}
          className="input"
          placeholder="ask the on-device model…"
          bindinput={(e) => setDraft(e.detail.value)}
        />
        <text className={`send ${busy ? 'send-disabled' : ''}`} bindtap={() => ask(draft)}>
          send
        </text>
      </view>
    </view>
  )
}
