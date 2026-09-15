import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { avg, casesOf, evaluatedOf, procedureSummaries, residentAlerts, rolling } from '../lib/stats'
import { cap, fmtDateLong, fmtRelative, todayISO } from '../lib/dates'
import { userById } from '../data/users'
import { AlertCard, Avatar, Kpi } from '../components/ui'
import { CaseRow, SupervisionBadge } from '../components/case'
import { Sparkline } from '../components/charts'

export default function ResidentHome() {
  const { user, cases } = useStore()
  const nav = useNavigate()
  const me = user!
  const mine = useMemo(() => casesOf(cases, me.id), [cases, me.id])
  const evals = evaluatedOf(mine)
  const pending = mine.filter((c) => c.status === 'pendiente').reverse()
  const alerts = useMemo(() => residentAlerts(me, mine, '/r'), [me, mine])
  const procs = useMemo(() => procedureSummaries(mine), [mine])
  const last = evals[evals.length - 1]
  const last10 = avg(evals.slice(-10).map((c) => c.evaluation.supervision))
  const first10 = avg(evals.slice(0, 10).map((c) => c.evaluation.supervision))
  const month = todayISO().slice(0, 7)
  const thisMonth = mine.filter((c) => c.date.startsWith(month)).length
  const competent = procs.filter((p) => p.cusum.state === 'competente').length
  const trend = rolling(evals.map((c) => c.evaluation.supervision), 8).slice(-40)
  const delta = last10 !== null && first10 !== null ? last10 - first10 : null

  return (
    <>
      <header className="topbar">
        <div className="grow">
          <div className="sub">{cap(fmtDateLong(todayISO()))}</div>
          <h1 style={{ fontSize: 22 }}>Hola, {me.name.split(' ')[0]}</h1>
        </div>
        <Link to="/r/perfil">
          <Avatar name={me.name} />
        </Link>
      </header>

      <div className="screen">
        <button className="hero-card row" style={{ width: '100%', border: 0, textAlign: 'left' }} onClick={() => nav('/r/nuevo')}>
          <div className="grow">
            <div className="muted small bold">¿Terminaste un caso?</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Regístralo en 1 minuto</div>
            <div className="muted small mt8">Contexto, procedimientos y listo. Tu adscrito lo evalúa.</div>
          </div>
          <span className="tab-fab" style={{ background: 'var(--accent)', marginTop: 0 }}>
            <Plus size={26} />
          </span>
        </button>

        {pending.length > 0 && (
          <>
            <div className="h2">Esperando evaluación</div>
            <div className="list">
              {pending.map((c) => (
                <CaseRow key={c.id} c={c} to={`/r/caso/${c.id}`} showAttending />
              ))}
            </div>
          </>
        )}

        {last && (
          <>
            <div className="h2">
              Última retroalimentación
              <Link to={`/r/caso/${last.id}`} className="link">
                Ver caso
              </Link>
            </div>
            <Link to={`/r/caso/${last.id}`} className="card card-link">
              <div className="row">
                <Avatar name={userById(last.evaluation.attendingId).name} att />
                <div className="grow">
                  <div className="bold">{userById(last.evaluation.attendingId).short}</div>
                  <div className="tiny muted">
                    {last.surgery} · {fmtRelative(last.date)}
                  </div>
                </div>
              </div>
              <div className="mt12">
                <SupervisionBadge v={last.evaluation.supervision} />
              </div>
              <div className="feedback-quote mt12">
                <div className="tiny muted bold">LO MEJOR</div>
                <div className="small">{last.evaluation.best}</div>
              </div>
              <div className="feedback-quote improve mt12">
                <div className="tiny muted bold">PRIORIDAD DE MEJORA</div>
                <div className="small">{last.evaluation.improve}</div>
              </div>
            </Link>
          </>
        )}

        <div className="h2">
          Tu avance
          <Link to="/r/progreso" className="link">
            Ver curvas
          </Link>
        </div>
        <div className="grid2">
          <Kpi
            label="Supervisión (últ. 10)"
            value={last10?.toFixed(1) ?? '—'}
            delta={delta !== null ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} desde tus primeros casos` : undefined}
            good={(delta ?? 0) >= 0}
          />
          <Kpi label="Casos este mes" value={thisMonth} hint={`${mine.length} en total`} />
          <Kpi label="Procedimientos" value={procs.reduce((s, p) => s + p.exposure, 0)} hint="como primer operador o parcial" />
          <Kpi label="Competencias CUSUM" value={`${competent}/${procs.filter((p) => p.exposure).length}`} hint="procedimientos con curva aceptable" />
        </div>
        <Link to="/r/progreso" className="card card-link row mt12">
          <Sparkles size={18} color="var(--accent-ink)" />
          <div className="grow">
            <div className="bold small">Tendencia de supervisión (O-SCORE)</div>
            <div className="tiny muted">Promedio móvil de tus últimos 40 casos</div>
          </div>
          <Sparkline values={trend} />
          <ChevronRight size={18} className="muted" />
        </Link>

        {alerts.length > 0 && (
          <>
            <div className="h2">Para tener en cuenta</div>
            <div className="stack">
              {alerts.slice(0, 3).map((a, i) => (
                <AlertCard key={i} alert={a} onClick={a.to ? () => nav(a.to!) : undefined} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
