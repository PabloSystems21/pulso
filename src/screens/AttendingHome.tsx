import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, CheckCircle2, ChevronRight, KeyRound } from 'lucide-react'
import { useStore } from '../store'
import { avg, programAlerts } from '../lib/stats'
import { cap, fmtDateLong, fmtDuration, todayISO } from '../lib/dates'
import { Avatar, Kpi } from '../components/ui'
import { CaseRow } from '../components/case'

export default function AttendingHome() {
  const { user, cases, accountOf } = useStore()
  const nav = useNavigate()
  const me = user!
  const pending = cases
    .filter((c) => c.status === 'pendiente' && c.attendingId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const alerts = useMemo(() => (me.profesor ? programAlerts(cases) : []), [cases, me.profesor])
  const critical = alerts.filter((a) => a.level === 'critical').length
  const month = todayISO().slice(0, 7)
  const myEvals = cases.filter((c) => c.evaluation?.attendingId === me.id)
  const myMonth = myEvals.filter((c) => c.date.startsWith(month))
  const avgSecs = avg(myMonth.map((c) => c.evaluation!.durationSec))
  const recent = [...myEvals].sort((a, b) => b.evaluation!.evaluatedAt.localeCompare(a.evaluation!.evaluatedAt)).slice(0, 4)
  const hour = new Date().getHours()
  const mustChangePassword = !accountOf(me.id).changed

  return (
    <>
      <header className="topbar">
        <div className="grow">
          <div className="sub">{cap(fmtDateLong(todayISO()))}</div>
          <h1 style={{ fontSize: 22 }}>
            {hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'}, {me.short.split(' ')[0]} {me.name.split(' ').slice(-1)}
          </h1>
        </div>
        <Link to="/a/perfil">
          <Avatar name={me.name} att />
        </Link>
      </header>

      <div className="screen">
        {mustChangePassword && (
          <Link to="/a/perfil" className="alert" style={{ borderLeftColor: 'var(--warn)', marginBottom: 12 }}>
            <span className="ico" style={{ color: '#c98500' }}>
              <KeyRound size={18} />
            </span>
            <span className="grow">
              <span className="t">Cambia tu contraseña</span>
              <span className="d">Sigues usando la contraseña genérica del programa.</span>
            </span>
            <ChevronRight size={18} className="muted" />
          </Link>
        )}

        {pending.length > 0 ? (
          <button className="hero-card" style={{ width: '100%', border: 0, textAlign: 'left' }} onClick={() => nav(`/a/evaluar/${pending[0].id}`)}>
            <div className="muted small bold">Por evaluar</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{pending.length}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>
                caso{pending.length > 1 ? 's' : ''} pendiente{pending.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="row between mt12">
              <span className="muted small">Autoevaluaciones esperando tu calificación</span>
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

        {me.profesor && alerts.length > 0 && (
          <>
            <div className="h2">Como profesor</div>
            <Link to="/a/alertas" className="card card-link row">
              <span className="avatar" style={{ background: 'var(--crit-soft)', color: 'var(--crit)' }}>
                <Bell size={18} />
              </span>
              <div className="grow">
                <div className="bold">
                  {alerts.length} alerta{alerts.length > 1 ? 's' : ''} del programa
                </div>
                <div className="small muted">{critical} crítica{critical === 1 ? '' : 's'} · casos sin adscrito, riesgos y CUSUM</div>
              </div>
              <ChevronRight size={18} className="muted" />
            </Link>
          </>
        )}

        <div className="h2">Este mes</div>
        <div className="grid2">
          <Kpi label="Evaluaciones hechas" value={myMonth.length} hint={`${myEvals.length} en total`} />
          <Kpi label="Tiempo promedio" value={avgSecs ? fmtDuration(avgSecs) : '—'} hint="min por evaluación" />
        </div>

        {recent.length > 0 && (
          <>
            <div className="h2">
              Mis evaluaciones recientes
              <Link to="/a/evaluados" className="link">
                Ver todas
              </Link>
            </div>
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
