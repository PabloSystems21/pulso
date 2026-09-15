import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, Check, Timer } from 'lucide-react'
import { useStore } from '../store'
import { userById } from '../data/users'
import { fmtDuration } from '../lib/dates'
import { ProcLine } from '../components/case'
import { Avatar } from '../components/ui'

export default function Sent() {
  const { id } = useParams()
  const { cases, switchTo } = useStore()
  const secs = (useLocation().state as { secs?: number } | null)?.secs
  const c = cases.find((x) => x.id === id)
  if (!c) return null
  const att = userById(c.attendingId)

  return (
    <div className="success-wrap">
      <div className="success-ico">
        <Check size={44} strokeWidth={3} />
      </div>
      <div className="h-hero mt16">¡Caso registrado!</div>
      <p className="ink2" style={{ maxWidth: 320 }}>
        Se envió a <b>{att.short}</b> para su evaluación. Te llegará su retroalimentación aquí mismo.
      </p>
      {secs !== undefined && (
        <span className="badge good" style={{ fontSize: 13, padding: '6px 12px' }}>
          <Timer size={14} /> Lo registraste en {fmtDuration(secs)} min
        </span>
      )}

      <div className="card mt24" style={{ width: '100%', textAlign: 'left' }}>
        <div className="bold">{c.surgery}</div>
        <div className="small muted">
          ASA {c.asa}
          {c.urgency === 'urgente' ? 'E' : ''} · {c.room} · {c.startTime}
        </div>
        {c.procedures.length > 0 && (
          <div className="stack mt12">
            {c.procedures.map((p) => (
              <ProcLine key={p.id} p={p} compact />
            ))}
          </div>
        )}
      </div>

      <div className="stack mt16" style={{ width: '100%' }}>
        <Link to="/r" className="btn primary block">
          Volver al inicio
        </Link>
        <Link to={`/r/caso/${c.id}`} className="btn block">
          Ver mi caso
        </Link>
      </div>

      <div className="card flat mt24" style={{ width: '100%', textAlign: 'left', borderStyle: 'dashed' }}>
        <span className="demo-pill">Demo</span>
        <div className="small ink2 mt8">Mira cómo le llega este caso a tu adscrito:</div>
        <button
          className="list-row"
          style={{ padding: '10px 0 0' }}
          onClick={() => switchTo(att.id, `/a/evaluar/${c.id}`)}
        >
          <Avatar name={att.name} att />
          <span className="grow bold">Entrar como {att.short}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
