import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, ShieldAlert, XCircle } from 'lucide-react'
import type { CaseRecord, ProcedureRecord } from '../types'
import { ANESTHESIA_LABEL, AREA_LABEL, ATTEMPT_TIMES, HELP, LOGRO, SUPERVISION, procDef } from '../data/catalog'
import { userById } from '../data/users'
import { fmtRelative } from '../lib/dates'
import { caseSupervision, procLabel } from '../lib/stats'
import { procedureOutcome } from '../lib/success'
import { Avatar } from './ui'

const nAttempts = (n: number) => (n === 6 ? '6+' : String(n))

export const attemptText = (p: Pick<ProcedureRecord, 'success' | 'attempts'>) =>
  p.success ? (p.attempts === 1 ? 'Al 1er intento' : `Al ${nAttempts(p.attempts)}º intento`) : `No se logró (${nAttempts(p.attempts)} int.)`

/** Lo mínimo del caso para saber cómo cuenta un procedimiento */
export type ProcCtx = Pick<CaseRecord, 'status' | 'attendingId' | 'evaluation' | 'professorReview'>

export function ProcLine({ p, c, compact, score }: { p: ProcedureRecord; c: ProcCtx; compact?: boolean; score?: number }) {
  const o = procedureOutcome(p, c)
  const logro = procDef(p.type).criterios.logro
  const ok = o.status === 'no-cuenta' || o.status === 'provisional' ? o.success : o.status === 'exito'
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span style={{ color: ok ? 'var(--good-ink)' : '#a32424', marginTop: 1 }}>{ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
      <div className="grow">
        <div className="row between">
          <span className="bold" style={{ fontSize: 14 }}>
            {procLabel(p)}
          </span>
          {score !== undefined && <span className="badge brand">O-SCORE {score}</span>}
        </div>
        <div className="small ink2">
          {attemptText(p)} · {HELP[p.help].label.toLowerCase()} · {ATTEMPT_TIMES.find((t) => t.id === p.time)?.label}
          {logro && p.logro !== undefined && ` · ${(p.logro ? LOGRO[logro].ok : LOGRO[logro].fail).toLowerCase()}`}
          {!p.firstOperator && ' · participó parcialmente'}
        </div>
        {!compact && (
          <div className="row wrap mt8" style={{ gap: 6 }}>
            {o.status === 'exito' && <span className="badge good">Éxito</span>}
            {o.status === 'fallo' && <span className="badge warn">Fallo</span>}
            {o.status === 'provisional' && <span className="badge">Provisional ({o.success ? 'éxito' : 'fallo'}) · se confirma al validar</span>}
            {o.status === 'no-cuenta' && <span className="badge">No cuenta · {o.excludedWhy}</span>}
            {o.override && (
              <span className="badge brand">
                Corregido por el adscrito: {o.override.from ? 'éxito' : 'fallo'} → {o.override.to ? 'éxito' : 'fallo'}
              </span>
            )}
            {p.incidents.map((i) => (
              <span key={i} className="badge crit">
                <AlertTriangle size={11} /> {i === 'Otro' && p.incidentOther ? p.incidentOther : i}
              </span>
            ))}
          </div>
        )}
        {!compact && o.reasons.length > 0 && !o.override && <div className="tiny muted mt8">No cumplió: {o.reasons.join(' · ')}</div>}
        {!compact && o.override && <div className="tiny muted mt8">Motivo de la corrección: {o.override.reason}</div>}
      </div>
    </div>
  )
}

export function SupervisionBadge({ v, label = 'O-SCORE' }: { v: number | undefined; label?: string }) {
  if (!v) return <span className="badge">No presenciado</span>
  const r = Math.round(v)
  const cls = r >= 4 ? 'good' : r === 3 ? 'brand' : r === 2 ? 'warn' : 'crit'
  return (
    <span className={`badge ${cls}`}>
      {label} {Number.isInteger(v) ? v : v.toFixed(1)} · {SUPERVISION[r - 1].short}
    </span>
  )
}

export const caseTitle = (c: CaseRecord) =>
  c.procedures.length ? c.procedures.map((p) => procDef(p.type).short).join(' · ') : 'Caso sin procedimientos'

export function CaseRow({ c, to, showResident, showAttending }: { c: CaseRecord; to: string; showResident?: boolean; showAttending?: boolean }) {
  const who = showResident ? userById(c.residentId) : showAttending && c.attendingId ? userById(c.attendingId) : null
  const sup = c.evaluation ? caseSupervision(c.evaluation) : null
  return (
    <Link to={to} className="list-row">
      {who && <Avatar name={who.name} att={who.role === 'adscrito'} />}
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row between">
          <span className="bold ellipsis">{showResident ? who!.short : caseTitle(c)}</span>
          <span className="tiny muted" style={{ flexShrink: 0 }}>
            {fmtRelative(c.date)}
          </span>
        </div>
        <div className="small muted ellipsis">
          {showResident ? `${caseTitle(c)} · ` : `${AREA_LABEL[c.area]} · `}ASA {c.asa}
          {c.urgency === 'urgente' ? 'E' : ''} · {ANESTHESIA_LABEL[c.anesthesia]}
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
          {c.status === 'pendiente' ? (
            <span className="badge warn">
              <Clock size={11} /> Pendiente de evaluación
            </span>
          ) : c.status === 'no-evaluable' ? (
            <span className="badge">No evaluable</span>
          ) : c.status === 'rechazado' ? (
            <span className="badge crit">Rechazado</span>
          ) : (
            sup !== null && <SupervisionBadge v={sup} />
          )}
          {!c.attendingId && (
            <span className="badge crit">
              <ShieldAlert size={11} /> Sin adscrito
            </span>
          )}
          {c.evaluation?.needsProfessorReview && !c.professorReview && <span className="badge warn">Amerita revisión</span>}
        </div>
      </div>
      <ChevronRight size={18} className="muted" style={{ flexShrink: 0 }} />
    </Link>
  )
}
