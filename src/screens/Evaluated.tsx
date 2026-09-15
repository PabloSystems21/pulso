import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, Check, Timer } from 'lucide-react'
import { useStore } from '../store'
import { userById } from '../data/users'
import { procDef } from '../data/catalog'
import { fmtDuration } from '../lib/dates'
import { casesOf, procedureSummaries } from '../lib/stats'
import { Avatar, CusumBadge } from '../components/ui'
import { SupervisionBadge } from '../components/case'

export default function Evaluated() {
  const { id } = useParams()
  const { user, cases, switchTo } = useStore()
  const secs = (useLocation().state as { secs?: number } | null)?.secs
  const c = cases.find((x) => x.id === id)
  const summaries = useMemo(() => (c ? procedureSummaries(casesOf(cases, c.residentId)) : []), [cases, c])
  if (!c || !c.evaluation) return null
  const resident = userById(c.residentId)
  const nextPending = cases.find((x) => x.status === 'pendiente' && x.attendingId === user!.id)
  const types = [...new Set(c.procedures.map((p) => p.type))].filter((t) => t !== 'otro')

  return (
    <div className="success-wrap">
      <div className="success-ico">
        <Check size={44} strokeWidth={3} />
      </div>
      <div className="h-hero mt16">Evaluación enviada</div>
      <p className="ink2" style={{ maxWidth: 320 }}>
        <b>{resident.short}</b> ya puede ver tu retroalimentación. Sus curvas se actualizaron.
      </p>
      {secs !== undefined && (
        <span className="badge good" style={{ fontSize: 13, padding: '6px 12px' }}>
          <Timer size={14} /> Completada en {fmtDuration(secs)} min
        </span>
      )}

      <div className="card mt24" style={{ width: '100%', textAlign: 'left' }}>
        <div className="bold">{c.surgery}</div>
        <div className="mt8">
          <SupervisionBadge v={c.evaluation.supervision} />
        </div>
        {types.length > 0 && (
          <div className="stack mt12" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="tiny muted bold">CURVAS ACTUALIZADAS</div>
            {types.map((t) => {
              const s = summaries.find((x) => x.def.id === t)!
              return (
                <div key={t} className="row between">
                  <span className="small bold">{procDef(t).short}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="tiny muted num">#{s.cusum.n}</span>
                    <CusumBadge state={s.cusum.state} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="stack mt16" style={{ width: '100%' }}>
        {nextPending ? (
          <Link to={`/a/evaluar/${nextPending.id}`} className="btn primary block">
            Siguiente pendiente ({userById(nextPending.residentId).name.split(' ')[0]}) <ArrowRight size={18} />
          </Link>
        ) : (
          <Link to="/a" className="btn primary block">
            Volver al inicio
          </Link>
        )}
        <Link to={`/a/residente/${resident.id}`} className="btn block">
          Ver progreso de {resident.name.split(' ')[0]}
        </Link>
      </div>

      <div className="card flat mt24" style={{ width: '100%', textAlign: 'left', borderStyle: 'dashed' }}>
        <span className="demo-pill">Demo</span>
        <div className="small ink2 mt8">Mira lo que recibe el residente:</div>
        <button
          className="list-row"
          style={{ padding: '10px 0 0' }}
          onClick={() => switchTo(resident.id, `/r/caso/${c.id}`)}
        >
          <Avatar name={resident.name} />
          <span className="grow bold">Entrar como {resident.short}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
