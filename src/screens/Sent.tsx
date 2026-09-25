import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, Check, Timer } from 'lucide-react'
import { useStore } from '../store'
import { PROFESORES, userById } from '../data/users'
import { AREA_LABEL } from '../data/catalog'
import { fmtDuration } from '../lib/dates'
import { ProcLine, caseTitle } from '../components/case'
import { Avatar } from '../components/ui'

export default function Sent() {
  const { id } = useParams()
  const { cases, switchTo } = useStore()
  const secs = (useLocation().state as { secs?: number } | null)?.secs
  const c = cases.find((x) => x.id === id)
  if (!c) return null
  const att = c.attendingId ? userById(c.attendingId) : PROFESORES[0]

  return (
    <div className="success-wrap">
      <div className="success-ico">
        <Check size={44} strokeWidth={3} />
      </div>
      <div className="h-hero mt16">¡Caso registrado!</div>
      <p className="ink2" style={{ maxWidth: 320 }}>
        {c.attendingId ? (
          <>
            Se envió a <b>{att.short}</b> para su evaluación. Te llegará su retroalimentación aquí mismo.
          </>
        ) : (
          <>
            Como no hubo adscrito, se envió a <b>los profesores</b> del programa para su revisión.
          </>
        )}
      </p>
      {secs !== undefined && (
        <span className="badge good" style={{ fontSize: 13, padding: '6px 12px' }}>
          <Timer size={14} /> Lo registraste en {fmtDuration(secs)} min
        </span>
      )}

      <div className="card mt24" style={{ width: '100%', textAlign: 'left' }}>
        <div className="bold">{caseTitle(c)}</div>
        <div className="small muted">
          {AREA_LABEL[c.area]} · ASA {c.asa}
          {c.urgency === 'urgente' ? 'E' : ''} · {c.startTime}
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
        <div className="small ink2 mt8">Mira cómo le llega este caso a quien lo evalúa:</div>
        <button className="list-row" style={{ padding: '10px 0 0' }} onClick={() => switchTo(att.id, c.attendingId ? `/a/evaluar/${c.id}` : `/a/caso/${c.id}`)}>
          <Avatar name={att.name} att />
          <span className="grow bold">Entrar como {att.short}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
