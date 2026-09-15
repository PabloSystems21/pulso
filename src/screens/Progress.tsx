import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { userById } from '../data/users'
import { ANTS_DOMAINS, ANTS_TARGET, GRADE_EXPECTATIONS, SUPERVISION, expectedBand } from '../data/catalog'
import { antsDomains, avg, casesOf, evaluatedOf, juicio, monthsIntoGrade, monthsIntoGradeAt, procedureSummaries, residentAlerts, rolling } from '../lib/stats'
import { daysBetween, fmtRelative, parseDate, todayISO } from '../lib/dates'
import { AlertCard, Avatar, CusumBadge, Kpi, TopBar } from '../components/ui'
import { DomainBars, ORDINAL_BLUE, Sparkline, StackedBar, TrendChart } from '../components/charts'

type Range = '3m' | '6m' | 'todo'
const RANGE_DAYS: Record<Range, number> = { '3m': 92, '6m': 183, todo: 99999 }

export default function Progress() {
  const { rid } = useParams()
  const { user, cases } = useStore()
  const nav = useNavigate()
  const u = userById(rid ?? user!.id)
  const base = rid ? `/a/residente/${rid}` : '/r'
  const [range, setRange] = useState<Range>('6m')

  const mine = useMemo(() => casesOf(cases, u.id), [cases, u.id])
  const evals = useMemo(() => evaluatedOf(mine), [mine])
  const inRange = evals.filter((c) => daysBetween(c.date, todayISO()) <= RANGE_DAYS[range])
  const procs = useMemo(() => procedureSummaries(mine), [mine])
  const alerts = useMemo(() => residentAlerts(u, mine, base), [u, mine, base])

  const smooth = rolling(inRange.map((c) => c.evaluation.supervision), 8)
  const points = inRange.map((c, i) => {
    const [lo, hi] = expectedBand(c.grade, monthsIntoGradeAt(c.date))
    return { t: parseDate(c.date).getTime(), date: c.date, y: c.evaluation.supervision, smooth: smooth[i], lo, hi }
  })
  const sup = avg(inRange.map((c) => c.evaluation.supervision))
  const ent = avg(inRange.map((c) => c.evaluation.entrustment))
  const jc = avg(inRange.map((c) => juicio(c.evaluation)))
  const last30 = evals.slice(-30)
  const dist = [1, 2, 3, 4, 5].map((v) => ({ label: SUPERVISION[v - 1].short, value: last30.filter((c) => c.evaluation.supervision === v).length, color: ORDINAL_BLUE[v - 1] }))
  const domains = antsDomains(evals.slice(-20).map((c) => c.evaluation))
  const band = u.grade ? expectedBand(u.grade, monthsIntoGrade(u)) : null
  const recentImprove = evals.slice(-5).reverse()

  return (
    <>
      <TopBar title={rid ? u.short : 'Mi progreso'} sub={`Residente ${u.grade} · ${mine.length} casos`} back={!!rid} right={rid ? <Avatar name={u.name} /> : undefined} />
      <div className="screen">
        {alerts.length > 0 && (
          <div className="stack" style={{ marginBottom: 6 }}>
            {alerts.map((a, i) => (
              <AlertCard key={i} alert={a} onClick={a.to ? () => nav(a.to!) : undefined} />
            ))}
          </div>
        )}

        <div className="h2">Supervisión requerida (O-SCORE)</div>
        <div className="card">
          <div className="segmented-tabs" style={{ marginBottom: 12 }}>
            {(['3m', '6m', 'todo'] as const).map((r) => (
              <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                {r === 'todo' ? 'Toda la residencia' : r === '3m' ? '3 meses' : '6 meses'}
              </button>
            ))}
          </div>
          <TrendChart points={points} yLabels={SUPERVISION.map((s) => s.short)} />
          <div className="legend">
            <span>
              <i style={{ background: 'var(--series-1)', width: 8, height: 8, borderRadius: 4, opacity: 0.4 }} />
              Cada caso
            </span>
            <span>
              <i style={{ background: 'var(--series-1)' }} />
              Promedio móvil (8 casos)
            </span>
            <span>
              <i className="band" style={{ background: 'rgba(12,163,12,.18)' }} />
              Esperado para el grado
            </span>
          </div>
          <div className="tiny muted mt8">1 = "tuve que hacerlo yo" · 5 = "independiente y seguro". Toca la gráfica para ver cada punto.</div>
        </div>

        <div className="grid3 mt12">
          <Kpi label="Supervisión" value={sup?.toFixed(1) ?? '—'} hint={band ? `Esperado ${band[0].toFixed(1)}–${band[1].toFixed(1)}` : undefined} />
          <Kpi label="Entrustment" value={ent?.toFixed(1) ?? '—'} hint="prospectivo" />
          <Kpi label="Juicio clínico" value={jc?.toFixed(1) ?? '—'} hint="Mini-CEX 1–5" />
        </div>

        <div className="h2">Distribución · últimos 30 casos</div>
        <div className="card">
          <StackedBar parts={dist} />
        </div>

        <div className="h2">Habilidades no técnicas (ANTS)</div>
        <div className="card">
          <DomainBars rows={ANTS_DOMAINS.map((d) => ({ label: d.label, value: domains[d.id] }))} max={4} target={u.grade ? ANTS_TARGET[u.grade] : undefined} />
          <div className="legend">
            <span>
              <i style={{ background: 'var(--series-1)' }} />
              Promedio últimos 20 casos (1–4)
            </span>
            <span>
              <i style={{ background: 'var(--ink)', width: 2, height: 12 }} />
              Esperado para {u.grade}
            </span>
          </div>
        </div>

        <div className="h2">Procedimientos · CUSUM</div>
        <div className="list">
          {procs
            .filter((p) => p.exposure > 0)
            .sort((a, b) => b.exposure - a.exposure)
            .map((p) => {
              const vals = p.cusum.points.map((x) => x.value)
              return (
                <Link key={p.def.id} to={`${base}/procedimiento/${p.def.id}`} className="list-row">
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="bold">{p.def.short}</div>
                    <div className="tiny muted num">
                      {p.cusum.n} registros · {Math.round(p.cusum.successRate * 100)}% éxito · {p.lastDate ? fmtRelative(p.lastDate).toLowerCase() : ''}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <CusumBadge state={p.cusum.state} />
                    </div>
                  </div>
                  <Sparkline values={vals} min={Math.min(p.cusum.h0, ...vals)} max={Math.max(p.cusum.h1, ...vals)} />
                  <ChevronRight size={18} className="muted" />
                </Link>
              )
            })}
        </div>
        <div className="tiny muted mt8">La curva baja con cada éxito y sube con cada falla. Toca un procedimiento para ver su CUSUM completa.</div>

        <div className="h2">Prioridades de mejora recientes</div>
        <div className="card stack">
          {recentImprove.map((c) => (
            <Link key={c.id} to={`${base}/caso/${c.id}`} className="feedback-quote improve" style={{ display: 'block' }}>
              <div className="small">{c.evaluation.improve}</div>
              <div className="tiny muted">
                {userById(c.evaluation.attendingId).short} · {fmtRelative(c.date)}
              </div>
            </Link>
          ))}
        </div>

        {u.grade && (
          <>
            <div className="h2">Lo que se espera de un {u.grade}</div>
            <div className="card">
              <div className="chips">
                {GRADE_EXPECTATIONS[u.grade].map((x) => (
                  <span key={x} className="badge brand" style={{ fontSize: 12.5, padding: '5px 10px' }}>
                    {x}
                  </span>
                ))}
              </div>
              <div className="tiny muted mt12">
                Mismo formulario para todos los grados; lo que cambia es el umbral de interpretación. Hoy: mes {Math.floor(monthsIntoGrade(u)) + 1} de 12 del grado.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
