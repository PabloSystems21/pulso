import {
  ANTS_DOMAINS,
  ANTS_ITEMS,
  type AntsDomain,
  EXCLUDE_UNDER_REVIEW,
  PROCEDURES,
  type ProcedureDef,
  expectedBand,
  procDef,
} from '../data/catalog'
import type { CaseRecord, Evaluation, ProcedureRecord, User } from '../types'
import { computeCusum, isCusumFailure, type CusumResult } from './cusum'
import { academicYearStart, RESIDENTS, userById } from '../data/users'
import { daysBetween, fmtDate, monthsBetween, parseDate, todayISO } from './dates'

export const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const byDate = (a: CaseRecord, b: CaseRecord) => (a.date + a.startTime).localeCompare(b.date + b.startTime)

export const casesOf = (cases: CaseRecord[], residentId: string) => cases.filter((c) => c.residentId === residentId).sort(byDate)

export type EvaluatedCase = CaseRecord & { evaluation: Evaluation }

export const evaluatedOf = (cases: CaseRecord[]) =>
  cases.filter((c): c is EvaluatedCase => c.status === 'evaluado' && !!c.evaluation)

/** Casos que alimentan las gráficas (ver EXCLUDE_UNDER_REVIEW en catalog.ts) */
export const chartCases = (cases: CaseRecord[]) =>
  evaluatedOf(cases).filter((c) => !(EXCLUDE_UNDER_REVIEW && c.evaluation.needsProfessorReview && !c.professorReview?.include))

/** El O-SCORE es por procedimiento: para el caso se usa el promedio */
export const caseSupervision = (e: Evaluation) => avg(Object.values(e.supervision))

export const juicio = (e: Evaluation) => avg(Object.values(e.miniCex))

export function antsDomains(evals: Evaluation[]): Record<AntsDomain, number | null> {
  const out = {} as Record<AntsDomain, number | null>
  for (const d of ANTS_DOMAINS) {
    const ids = ANTS_ITEMS.filter((i) => i.domain === d.id).map((i) => i.id)
    out[d.id] = avg(evals.flatMap((e) => ids.map((id) => e.ants[id])))
  }
  return out
}

export const monthsIntoGrade = (u: User, at = todayISO()) =>
  u.gradeStart ? monthsBetween(new Date(u.gradeStart), parseDate(at)) : 0

/** Meses transcurridos del ciclo académico (inicia 1 de marzo) en una fecha dada */
export const monthsIntoGradeAt = (date: string) => {
  const d = parseDate(date)
  return monthsBetween(academicYearStart(d), d)
}

export const procedureCount = (cases: CaseRecord[]) => cases.reduce((s, c) => s + c.procedures.length, 0)

export interface ProcSummary {
  def: ProcedureDef
  exposure: number // todas las participaciones
  cusum: CusumResult // solo como primer operador
  lastDate?: string
  daysSince?: number
  /** O-SCORE promedio que le han puesto en este procedimiento */
  supervision: number | null
}

export function procedureSummaries(residentCases: CaseRecord[]): ProcSummary[] {
  const today = todayISO()
  const charted = chartCases(residentCases)
  return PROCEDURES.filter((d) => d.id !== 'otro').map((def) => {
    const all = residentCases.flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((proc) => ({ date: c.date, caseId: c.id, proc })))
    const cusum = computeCusum(all.filter((x) => x.proc.firstOperator), def)
    const lastDate = all.length ? all[all.length - 1].date : undefined
    const supervision = avg(
      charted.flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((p) => c.evaluation.supervision[p.id] ?? null)),
    )
    return { def, exposure: all.length, cusum, lastDate, daysSince: lastDate ? daysBetween(lastDate, today) : undefined, supervision }
  })
}

/** Serie de O-SCORE de un procedimiento concreto (para su pantalla de detalle) */
export function procedureScores(residentCases: CaseRecord[], type: string) {
  return chartCases(residentCases).flatMap((c) =>
    c.procedures.filter((p) => p.type === type).map((p) => ({ date: c.date, caseId: c.id, v: c.evaluation.supervision[p.id] })).filter((x) => !!x.v),
  )
}

export const procLabel = (p: ProcedureRecord) => (p.label && (p.type === 'otro' || p.type === 'periferico') ? `${procDef(p.type).short}: ${p.label}` : procDef(p.type).label)

export const failsFor = (p: ProcedureRecord) => isCusumFailure(p, procDef(p.type))

// ───────────────────────── Alertas ─────────────────────────

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface Alert {
  level: AlertLevel
  kind: 'cusum' | 'exposicion' | 'riesgo' | 'sin-adscrito' | 'revision' | 'desempeno'
  title: string
  detail: string
  residentId?: string
  to?: string
}

const KEY_PROCS = new Set(['laringoscopia', 'espinal', 'epidural', 'arterial', 'cvc'])
const NO_EXPOSURE_DAYS = 40

/** Alertas del desempeño de un residente. Solo las ven profesores. */
export function residentAlerts(u: User, residentCases: CaseRecord[], basePath: string): Alert[] {
  const out: Alert[] = []
  for (const s of procedureSummaries(residentCases)) {
    if (s.cusum.state === 'alerta') {
      const last = s.cusum.points.slice(-6).filter((p) => p.fail).length
      out.push({
        level: 'critical',
        kind: 'cusum',
        residentId: u.id,
        title: `Caída de desempeño en ${s.def.short}`,
        detail: `${last} de los últimos 6 como falla · la CUSUM cruzó el límite inaceptable`,
        to: `${basePath}/procedimiento/${s.def.id}`,
      })
    }
    if (KEY_PROCS.has(s.def.id) && s.daysSince !== undefined && s.daysSince > NO_EXPOSURE_DAYS) {
      out.push({
        level: 'info',
        kind: 'exposicion',
        residentId: u.id,
        title: `Sin exposición a ${s.def.short}`,
        detail: `Último registro hace ${s.daysSince} días`,
        to: `${basePath}/procedimiento/${s.def.id}`,
      })
    }
  }
  if (u.grade) {
    const last10 = chartCases(residentCases).slice(-10)
    const m = avg(last10.map((c) => caseSupervision(c.evaluation)))
    const [lo] = expectedBand(u.grade, monthsIntoGrade(u))
    if (m !== null && last10.length >= 5 && m < lo - 0.25)
      out.push({
        level: 'warning',
        kind: 'desempeno',
        residentId: u.id,
        title: `Por debajo de lo esperado para ${u.grade}`,
        detail: `O-SCORE promedio ${m.toFixed(1)} vs. ${lo.toFixed(1)} esperado`,
        to: basePath,
      })
  }
  return out
}

/** Todo lo que un profesor debe atender en el programa */
export function programAlerts(cases: CaseRecord[]): Alert[] {
  const today = todayISO()
  const out: Alert[] = []
  const recent = (c: CaseRecord) => daysBetween(c.date, today) <= 45

  cases.filter((c) => c.attendingId === null && recent(c)).forEach((c) => {
    out.push({
      level: 'critical',
      kind: 'sin-adscrito',
      residentId: c.residentId,
      title: 'Caso sin adscrito',
      detail: `${c.supervisionGap === 'residente-mayor' ? 'Con residente de mayor jerarquía' : 'Estuvo solo'} · ${fmtDate(c.date)}`,
      to: `/a/caso/${c.id}`,
    })
  })

  evaluatedOf(cases)
    .filter((c) => recent(c) && c.evaluation.patientRisk)
    .forEach((c) =>
      out.push({
        level: 'critical',
        kind: 'riesgo',
        residentId: c.residentId,
        title: 'Riesgo para el paciente',
        detail: c.evaluation.patientRiskNote ?? `Reportado por ${userById(c.evaluation.attendingId).short}`,
        to: `/a/caso/${c.id}`,
      }),
    )

  evaluatedOf(cases)
    .filter((c) => recent(c) && c.evaluation.needsProfessorReview && !c.professorReview && !c.evaluation.patientRisk && !!c.attendingId)
    .forEach((c) =>
      out.push({
        level: 'warning',
        kind: 'revision',
        residentId: c.residentId,
        title: 'Amerita revisión de un profesor',
        detail: `Lo pidió ${userById(c.evaluation.attendingId).short} · ${fmtDate(c.date)}`,
        to: `/a/caso/${c.id}`,
      }),
    )

  RESIDENTS.forEach((u) => {
    residentAlerts(u, casesOf(cases, u.id), `/a/residente/${u.id}`)
      .filter((a) => a.kind === 'cusum' || a.kind === 'desempeno')
      .forEach((a) => out.push(a))
  })

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

/** Promedio móvil simple sobre una serie ordenada */
export function rolling(values: number[], w: number) {
  return values.map((_, i) => {
    const s = values.slice(Math.max(0, i - w + 1), i + 1)
    return s.reduce((a, b) => a + b, 0) / s.length
  })
}
