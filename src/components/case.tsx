import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react'
import type { CaseRecord, ProcedureRecord } from '../types'
import { ATTEMPT_TIMES, HELP, SUPERVISION, procDef, specialtyLabel } from '../data/catalog'
import { userById } from '../data/users'
import { fmtRelative } from '../lib/dates'
import { isCusumFailure } from '../lib/cusum'
import { Avatar } from './ui'

export const attemptText = (p: Pick<ProcedureRecord, 'success' | 'attempts'>) =>
  p.success ? (p.attempts === 1 ? 'Al 1er intento' : `Al ${p.attempts === 4 ? '4º+' : `${p.attempts}º`} intento`) : `No se logró (${p.attempts === 4 ? '4+' : p.attempts} int.)`

export const procName = (p: ProcedureRecord) => (p.type === 'otro' && p.otherLabel ? p.otherLabel : procDef(p.type).label)

export function ProcLine({ p, compact }: { p: ProcedureRecord; compact?: boolean }) {
  const fail = isCusumFailure(p, procDef(p.type))
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span style={{ color: p.success ? 'var(--good-ink)' : '#a32424', marginTop: 1 }}>{p.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
      <div className="grow">
        <div className="bold" style={{ fontSize: 14 }}>
          {procName(p)}
        </div>
        <div className="small ink2">
          {attemptText(p)} · {HELP[p.help].label.toLowerCase()} · {ATTEMPT_TIMES.find((t) => t.id === p.time)?.label}
          {!p.firstOperator && ' · participó parcialmente'}
        </div>
        {!compact && (
          <div className="row wrap mt8" style={{ gap: 6 }}>
            <span className={`badge ${fail ? 'warn' : 'good'}`}>CUSUM: {fail ? 'cuenta como falla' : 'cuenta como éxito'}</span>
            {p.incidents.map((i) => (
              <span key={i} className="badge crit">
                <AlertTriangle size={11} /> {i}
              </span>
            ))}
            {!p.safety && <span className="badge crit">Criterios de seguridad no cumplidos</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function SupervisionBadge({ v }: { v: number }) {
  const cls = v >= 4 ? 'good' : v === 3 ? 'brand' : v === 2 ? 'warn' : 'crit'
  return (
    <span className={`badge ${cls}`}>
      O-SCORE {v} · {SUPERVISION[v - 1].short}
    </span>
  )
}

export function CaseRow({ c, to, showResident, showAttending }: { c: CaseRecord; to: string; showResident?: boolean; showAttending?: boolean }) {
  const who = showResident ? userById(c.residentId) : showAttending ? userById(c.attendingId) : null
  return (
    <Link to={to} className="list-row">
      {who && <Avatar name={who.name} att={who.role === 'adscrito'} />}
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row between">
          <span className="bold ellipsis">{showResident ? who!.short : c.surgery}</span>
          <span className="tiny muted" style={{ flexShrink: 0 }}>
            {fmtRelative(c.date)}
          </span>
        </div>
        <div className="small muted ellipsis">
          {showResident ? `${c.surgery} · ` : `${specialtyLabel(c.specialty)} · `}ASA {c.asa}
          {c.urgency === 'urgente' ? 'E' : ''}
          {c.procedures.length ? ` · ${c.procedures.map((p) => procDef(p.type).short).join(', ')}` : ''}
        </div>
        <div className="row mt8" style={{ gap: 6, marginTop: 6 }}>
          {c.status === 'pendiente' ? (
            <span className="badge warn">
              <Clock size={11} /> Pendiente de evaluación
            </span>
          ) : (
            c.evaluation && <SupervisionBadge v={c.evaluation.supervision} />
          )}
        </div>
      </div>
      <ChevronRight size={18} className="muted" style={{ flexShrink: 0 }} />
    </Link>
  )
}
