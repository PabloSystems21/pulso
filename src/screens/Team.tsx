import { useMemo, useState } from 'react'
import { KeyRound, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { ATTENDINGS, initialPassword, userById } from '../data/users'
import { avg, caseSupervision, evaluatedOf } from '../lib/stats'
import { daysBetween, todayISO } from '../lib/dates'
import { Avatar, Sheet, TopBar } from '../components/ui'

export default function Team() {
  const { cases, accountOf, resetPassword } = useStore()
  const [reset, setReset] = useState<string | null>(null)
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
          changed: accountOf(a.id).changed,
        }
      }).sort((x, y) => y.pending - x.pending),
    [cases, accountOf, today],
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
              {!r.changed && (
                <div className="row between mt12" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <span className="small" style={{ color: 'var(--warn-ink)' }}>
                    <KeyRound size={13} /> No ha cambiado su contraseña
                  </span>
                  <button className="btn sm" onClick={() => setReset(r.a.id)}>
                    <RotateCcw size={14} /> Restablecer
                  </button>
                </div>
              )}
              {r.changed && (
                <button className="btn sm mt12" onClick={() => setReset(r.a.id)}>
                  <RotateCcw size={14} /> Restablecer contraseña
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="tiny muted mt16">
          El "O-SCORE que pone" ayuda a detectar si alguien evalúa siempre igual. No califica al adscrito: es solo para revisión del equipo de enseñanza.
        </div>
      </div>

      <Sheet open={!!reset} onClose={() => setReset(null)}>
        {reset && (
          <>
            <div className="bold" style={{ fontSize: 18 }}>
              ¿Restablecer la contraseña de {userById(reset).short}?
            </div>
            <p className="small ink2">
              Volverá a la contraseña genérica <b className="num">{initialPassword(userById(reset))}</b> y se le pedirá cambiarla al entrar.
            </p>
            <div className="row mt16">
              <button className="btn block" onClick={() => setReset(null)}>
                Cancelar
              </button>
              <button
                className="btn primary block"
                onClick={() => {
                  resetPassword(reset)
                  setReset(null)
                }}
              >
                Restablecer
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}
