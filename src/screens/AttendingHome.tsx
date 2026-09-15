import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store'
import { RESIDENTS, userById } from '../data/users'
import { avg, casesOf, residentAlerts } from '../lib/stats'
import { cap, fmtDateLong, fmtDuration, todayISO } from '../lib/dates'
import { AlertCard, Avatar, Kpi } from '../components/ui'
import { CaseRow } from '../components/case'

export default function AttendingHome() {
  const { user, cases } = useStore()
  const nav = useNavigate()
  const me = user!
  const pending = cases.filter((c) => c.status === 'pendiente' && c.attendingId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const alerts = useMemo(() => RESIDENTS.flatMap((r) => residentAlerts(r, casesOf(cases, r.id), `/a/residente/${r.id}`)), [cases])
  const critical = alerts.filter((a) => a.level === 'critical')
  const shownAlerts = [...critical, ...alerts.filter((a) => a.level !== 'critical')].slice(0, 4)
  const month = todayISO().slice(0, 7)
  const myEvals = cases.filter((c) => c.evaluation?.attendingId === me.id)
  const myMonth = myEvals.filter((c) => c.date.startsWith(month))
  const avgSecs = avg(myMonth.map((c) => c.evaluation!.durationSec))
  const recent = [...myEvals].sort((a, b) => b.evaluation!.evaluatedAt.localeCompare(a.evaluation!.evaluatedAt)).slice(0, 4)
  const hour = new Date().getHours()

  return (
    <>
      <header className="topbar">
        <div className="grow">
          <div className="sub">{cap(fmtDateLong(todayISO()))}</div>
          <h1 style={{ fontSize: 22 }}>
            {hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'}, {me.short.split(' ').slice(0, 1).join('')} {me.name.split(' ').slice(-1)}
          </h1>
        </div>
        <Link to="/a/perfil">
          <Avatar name={me.name} att />
        </Link>
      </header>

      <div className="screen">
        {pending.length > 0 ? (
          <button className="hero-card" style={{ width: '100%', border: 0, textAlign: 'left' }} onClick={() => nav(`/a/evaluar/${pending[0].id}`)}>
            <div className="muted small bold">Por evaluar</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{pending.length}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>caso{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''}</span>
            </div>
            <div className="row between mt12">
              <span className="muted small">≈ 2 min cada uno · versión corta</span>
              <span className="btn sm accent" style={{ boxShadow: 'none' }}>
                Empezar <ArrowRight size={16} />
              </span>
            </div>
          </button>
        ) : (
          <div className="card row">
            <CheckCircle2 color="var(--good)" />
            <div className="grow">
              <div className="bold">Estás al día</div>
              <div className="small muted">No tienes casos pendientes por evaluar.</div>
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <div className="h2">Pendientes</div>
            <div className="list">
              {pending.map((c) => (
                <CaseRow key={c.id} c={c} to={`/a/evaluar/${c.id}`} showResident />
              ))}
            </div>
          </>
        )}

        {shownAlerts.length > 0 && (
          <>
            <div className="h2">
              Alertas de residentes
              <Link to="/a/residentes" className="link">
                Ver todos
              </Link>
            </div>
            <div className="stack">
              {shownAlerts.map((a, i) => (
                <AlertCard key={i} alert={a} who={userById(a.residentId).short} onClick={a.to ? () => nav(a.to!) : () => nav(`/a/residente/${a.residentId}`)} />
              ))}
            </div>
          </>
        )}

        <div className="h2">Este mes</div>
        <div className="grid2">
          <Kpi label="Evaluaciones hechas" value={myMonth.length} hint={`${myEvals.length} en total`} />
          <Kpi label="Tiempo promedio" value={avgSecs ? `${fmtDuration(avgSecs)}` : '—'} hint="min por evaluación" />
        </div>

        {recent.length > 0 && (
          <>
            <div className="h2">Mis evaluaciones recientes</div>
            <div className="list">
              {recent.map((c) => (
                <CaseRow key={c.id} c={c} to={`/a/caso/${c.id}`} showResident />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
