import { useMemo } from 'react'
import { useStore } from '../store'
import { ATTENDINGS } from '../data/users'
import { avg, caseSupervision, evaluatedOf } from '../lib/stats'
import { daysBetween, todayISO } from '../lib/dates'
import { Avatar, TopBar } from '../components/ui'

export default function Team() {
  const { cases } = useStore()
  const today = todayISO()

  const rows = useMemo(
    () =>
      ATTENDINGS.map((a) => {
        const pending = cases.filter((c) => c.status === 'pendiente' && c.attendingId === a.id)
        const mine = evaluatedOf(cases).filter((c) => c.evaluation.attendingId === a.id)
        const last30 = mine.filter((c) => daysBetween(c.date, today) <= 30)
        const oldest = pending.reduce<number>((m, c) => Math.max(m, daysBetween(c.date, today)), 0)
        return {
          a,
          pending: pending.length,
          oldest,
          last30: last30.length,
          given: avg(last30.map((c) => caseSupervision(c.evaluation))),
          minutes: avg(last30.map((c) => c.evaluation.durationSec)),
        }
      }).sort((x, y) => y.pending - x.pending),
    [cases, today],
  )

  return (
    <>
      <TopBar title="Equipo de adscritos" sub={`${ATTENDINGS.length} médicos del servicio`} back fallback="/a/alertas" />
      <div className="screen">
        <div className="stack">
          {rows.map((r) => (
            <div key={r.a.id} className="card">
              <div className="row">
                <Avatar name={r.a.name} att />
                <div className="grow">
                  <div className="bold">{r.a.short}</div>
                  <div className="tiny muted num">
                    {r.a.id} · {r.a.profesor ? 'Profesor' : 'Adscrito'}
                  </div>
                </div>
                {r.pending > 0 ? <span className={`badge ${r.oldest > 2 ? 'crit' : 'warn'}`}>{r.pending} por evaluar</span> : <span className="badge good">Al día</span>}
              </div>
              <div className="grid3 mt12">
                <div>
                  <div className="tiny muted">Evaluó (30 d)</div>
                  <div className="bold num">{r.last30}</div>
                </div>
                <div>
                  <div className="tiny muted">O-SCORE que pone</div>
                  <div className="bold num">{r.given?.toFixed(1) ?? '—'}</div>
                </div>
                <div>
                  <div className="tiny muted">Pendiente más viejo</div>
                  <div className="bold num">{r.pending ? `${r.oldest} d` : '—'}</div>
                </div>
              </div>
              {/* Contraseñas: solo el super admin las ve y las restablece */}
            </div>
          ))}
        </div>
        <div className="tiny muted mt16">
          El "O-SCORE que pone" ayuda a detectar si alguien evalúa siempre igual. No califica al adscrito: es solo para revisión del equipo de enseñanza.
        </div>
      </div>
    </>
  )
}
