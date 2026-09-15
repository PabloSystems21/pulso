// Gráficas SVG hechas a mano: ligeras, responsivas y con tooltip táctil.
import { useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { CusumResult } from '../lib/cusum'
import { fmtDate } from '../lib/dates'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(340)
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const linePath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')

function nearestIndex(xs: number[], x: number) {
  let best = 0
  let d = Infinity
  xs.forEach((v, i) => {
    const dd = Math.abs(v - x)
    if (dd < d) {
      d = dd
      best = i
    }
  })
  return best
}

// ─────────────────────────── Tendencia de supervisión ───────────────────────────

export interface TrendPoint {
  t: number // timestamp
  date: string
  y: number
  smooth: number
  lo?: number
  hi?: number
}

export function TrendChart({ points, yLabels, height = 190 }: { points: TrendPoint[]; yLabels: string[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { l: 22, r: 10, t: 10, b: 22 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = height - m.t - m.b
  if (!points.length) return <div ref={ref} className="small muted">Sin evaluaciones en este periodo.</div>
  const t0 = points[0].t
  const t1 = Math.max(points[points.length - 1].t, t0 + 86_400_000)
  const X = (t: number) => m.l + ((t - t0) / (t1 - t0)) * iw
  const Y = (v: number) => m.t + ih - ((v - 1) / 4) * ih
  const xs = points.map((p) => X(p.t))
  const band = points.filter((p) => p.lo !== undefined)
  const bandPath = band.length
    ? linePath(band.map((p) => [X(p.t), Y(p.hi!)])) + band.slice().reverse().map((p) => `L${X(p.t).toFixed(1)},${Y(p.lo!).toFixed(1)}`).join('') + 'Z'
    : ''
  // marcas del eje X: ~4 fechas
  const ticks = [0, 0.33, 0.66, 1].map((f) => t0 + f * (t1 - t0))

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    setHover(nearestIndex(xs, e.clientX - r.left))
  }
  const hp = hover !== null ? points[hover] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart" width={w} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line className="grid" x1={m.l} x2={m.l + iw} y1={Y(v)} y2={Y(v)} />
            <text x={m.l - 8} y={Y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {bandPath && <path d={bandPath} fill="var(--good)" opacity={0.1} />}
        {band.length > 0 && <path d={linePath(band.map((p) => [X(p.t), Y(p.lo!)]))} fill="none" stroke="var(--good)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />}
        {points.map((p, i) => (
          <circle key={i} cx={X(p.t)} cy={Y(p.y)} r={3} fill="var(--series-1)" opacity={0.28} />
        ))}
        <path d={linePath(points.map((p) => [X(p.t), Y(p.smooth)]))} fill="none" stroke="var(--series-1)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs[xs.length - 1]} cy={Y(points[points.length - 1].smooth)} r={5} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
        {ticks.map((t, i) => (
          <text key={i} x={X(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}>
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}
        {hp && (
          <g>
            <line x1={X(hp.t)} x2={X(hp.t)} y1={m.t} y2={m.t + ih} stroke="var(--ink)" strokeWidth={1} opacity={0.25} />
            <circle cx={X(hp.t)} cy={Y(hp.smooth)} r={5} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(X(hp.t), 80), w - 80), top: Y(hp.smooth) }}>
          <div className="bold">{fmtDate(hp.date)}</div>
          Caso: {hp.y} · {yLabels[hp.y - 1]}
          <br />
          Promedio móvil: {hp.smooth.toFixed(1)}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── CUSUM ───────────────────────────

export function CusumChart({ result, height = 220 }: { result: CusumResult; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { l: 30, r: 12, t: 16, b: 24 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = height - m.t - m.b
  const pts = result.points
  const vals = pts.map((p) => p.value)
  const lo = Math.min(result.h0 * 1.35, ...vals, 0)
  const hi = Math.max(result.h1 * 1.35, ...vals, 0)
  const n = Math.max(pts.length, 10)
  const X = (i: number) => m.l + (i / n) * iw
  const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * ih
  const path = linePath([[X(0), Y(0)], ...pts.map((p) => [X(p.n), Y(p.value)] as [number, number])])
  const xs = pts.map((p) => X(p.n))
  const yTicks = [Math.ceil(lo), 0, Math.floor(hi)].filter((v, i, a) => a.indexOf(v) === i)
  const xStep = n > 60 ? 20 : n > 25 ? 10 : 5

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!pts.length) return
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    setHover(nearestIndex(xs, e.clientX - r.left))
  }
  const hp = hover !== null ? pts[hover] : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart" width={w} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        {yTicks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'axis' : 'grid'} x1={m.l} x2={m.l + iw} y1={Y(v)} y2={Y(v)} />
            <text x={m.l - 6} y={Y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(n / xStep) }, (_, i) => (i + 1) * xStep).map((v) => (
          <text key={v} x={X(v)} y={height - 8} textAnchor="middle">
            {v}
          </text>
        ))}
        {/* líneas de decisión */}
        <line x1={m.l} x2={m.l + iw} y1={Y(result.h1)} y2={Y(result.h1)} stroke="var(--crit)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={m.l + iw} y={Y(result.h1) - 5} textAnchor="end" style={{ fill: '#a32424', fontWeight: 600 }}>
          Límite inaceptable
        </text>
        <line x1={m.l} x2={m.l + iw} y1={Y(result.h0)} y2={Y(result.h0)} stroke="var(--good)" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={m.l + iw} y={Y(result.h0) + 13} textAnchor="end" style={{ fill: 'var(--good-ink)', fontWeight: 600 }}>
          Límite aceptable
        </text>
        {result.competentAt && (
          <g>
            <line x1={X(result.competentAt)} x2={X(result.competentAt)} y1={m.t} y2={m.t + ih} stroke="var(--good)" strokeWidth={1} opacity={0.5} />
            <text
              x={X(result.competentAt) + (X(result.competentAt) < m.l + 110 ? 4 : -4)}
              y={m.t + ih - 5}
              style={{ fill: 'var(--good-ink)', fontWeight: 600 }}
              textAnchor={X(result.competentAt) < m.l + 110 ? 'start' : 'end'}
            >
              Competencia · #{result.competentAt}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p) =>
          p.fail ? <circle key={p.n} cx={X(p.n)} cy={Y(p.value)} r={4} fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} /> : null,
        )}
        {hp && (
          <g>
            <line x1={X(hp.n)} x2={X(hp.n)} y1={m.t} y2={m.t + ih} stroke="var(--ink)" opacity={0.25} />
            <circle cx={X(hp.n)} cy={Y(hp.value)} r={5} fill={hp.fail ? 'var(--series-2)' : 'var(--series-1)'} stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(X(hp.n), 70), w - 70), top: Y(hp.value) }}>
          <div className="bold">
            #{hp.n} · {fmtDate(hp.date)}
          </div>
          {hp.fail ? 'Falla' : 'Éxito'} · CUSUM {hp.value.toFixed(2)}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Sparkline ───────────────────────────

export function Sparkline({ values, width = 84, height = 30, min = 1, max = 5 }: { values: number[]; width?: number; height?: number; min?: number; max?: number }) {
  if (values.length < 2) return <svg width={width} height={height} className="spark" />
  const X = (i: number) => 2 + (i / (values.length - 1)) * (width - 6)
  const Y = (v: number) => 3 + (1 - (v - min) / (max - min)) * (height - 6)
  const last = values[values.length - 1]
  return (
    <svg width={width} height={height} className="spark" aria-hidden>
      <path d={linePath(values.map((v, i) => [X(i), Y(v)]))} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(values.length - 1)} cy={Y(last)} r={3.5} fill="var(--series-1)" stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  )
}

// ─────────────────────────── Barras de dominio ───────────────────────────

export function DomainBars({ rows, max, target }: { rows: { label: string; value: number | null }[]; max: number; target?: number }) {
  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="row between small">
            <span className="ink2" style={{ fontWeight: 600 }}>
              {r.label}
            </span>
            <span className="bold num">{r.value === null ? '—' : r.value.toFixed(1)}</span>
          </div>
          <div className="bar-track mt8" style={{ marginTop: 5 }}>
            <div className="bar-fill" style={{ width: `${r.value ? ((r.value - 1) / (max - 1)) * 100 : 0}%` }} />
            {target && <div className="bar-target" style={{ left: `calc(${((target - 1) / (max - 1)) * 100}% - 1px)` }} title="Esperado" />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────── Barra apilada (ordinal) ───────────────────────────

export const ORDINAL_BLUE = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']

export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div>
      <div className="stacked">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
          ))}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.label}>
            <i className="band" style={{ background: p.color, width: 10 }} />
            {p.label} <b className="num">{Math.round((p.value / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}
