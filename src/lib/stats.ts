import { ANTS_DOMAINS, ANTS_ITEMS, type AntsDomain, PROCEDURES, type ProcedureDef, expectedBand } from '../data/catalog'
import type { CaseRecord, Evaluation, User } from '../types'
import { computeCusum, type CusumResult } from './cusum'
import { daysBetween, monthsBetween, parseDate, todayISO } from './dates'
import { FOLLOWUP_LABEL } from '../data/catalog'
import { academicYearStart } from '../data/users'

export const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const byDate = (a: CaseRecord, b: CaseRecord) => (a.date + a.startTime).localeCompare(b.date + b.startTime)

export const casesOf = (cases: CaseRecord[], residentId: string) => cases.filter((c) => c.residentId === residentId).sort(byDate)

export const evaluatedOf = (cases: CaseRecord[]) =>
  cases.filter((c): c is CaseRecord & { evaluation: Evaluation } => c.status === 'evaluado' && !!c.evaluation)

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

export interface ProcSummary {
  def: ProcedureDef
  exposure: number // todas las participaciones
  cusum: CusumResult // solo como primer operador
  lastDate?: string
  daysSince?: number
}

export function procedureSummaries(residentCases: CaseRecord[]): ProcSummary[] {
  const today = todayISO()
  return PROCEDURES.filter((d) => d.id !== 'otro')
    .map((def) => {
      const all = residentCases.flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((proc) => ({ date: c.date, caseId: c.id, proc })))
      const cusum = computeCusum(all.filter((x) => x.proc.firstOperator), def)
      const lastDate = all.length ? all[all.length - 1].date : undefined
      return { def, exposure: all.length, cusum, lastDate, daysSince: lastDate ? daysBetween(lastDate, today) : undefined }
    })
}

export interface Alert {
  level: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  residentId: string
  to?: string
}

const KEY_PROCS = new Set(['iot', 'neuroaxial', 'epidural', 'arterial', 'cvc'])
const NO_EXPOSURE_DAYS = 40

export function residentAlerts(u: User, residentCases: CaseRecord[], basePath: string): Alert[] {
  const out: Alert[] = []
  const today = todayISO()
  for (const s of procedureSummaries(residentCases)) {
    if (s.cusum.state === 'alerta') {
      const last = s.cusum.points.slice(-6).filter((p) => p.fail).length
      out.push({
        level: 'critical',
        residentId: u.id,
        title: `Caída de desempeño en ${s.def.short.toLowerCase()}`,
        detail: `${last} de los últimos 6 como falla · la CUSUM cruzó el límite inaceptable`,
        to: `${basePath}/procedimiento/${s.def.id}`,
      })
    }
    if (KEY_PROCS.has(s.def.id) && s.daysSince !== undefined && s.daysSince > NO_EXPOSURE_DAYS) {
      out.push({
        level: 'warning',
        residentId: u.id,
        title: `Sin exposición a ${s.def.short}`,
        detail: `Último registro hace ${s.daysSince} días`,
        to: `${basePath}/procedimiento/${s.def.id}`,
      })
    }
  }
  const recent = evaluatedOf(residentCases).filter((c) => daysBetween(c.date, today) <= 30)
  const fu = recent.filter((c) => c.evaluation.followUp !== 'no')
  if (fu.length) {
    const last = fu[fu.length - 1]
    out.push({
      level: 'warning',
      residentId: u.id,
      title: `${fu.length} seguimiento${fu.length > 1 ? 's' : ''} activo${fu.length > 1 ? 's' : ''}`,
      detail: FOLLOWUP_LABEL[last.evaluation.followUp].replace('Sí, ', ''),
      to: `${basePath}/caso/${last.id}`,
    })
  }
  const risk = recent.filter((c) => c.evaluation.patientRisk === 'real')
  if (risk.length) out.push({ level: 'critical', residentId: u.id, title: 'Riesgo real para paciente', detail: `${risk.length} caso(s) en 30 días`, to: `${basePath}/caso/${risk[risk.length - 1].id}` })

  if (u.grade) {
    const last10 = evaluatedOf(residentCases).slice(-10)
    const m = avg(last10.map((c) => c.evaluation.supervision))
    const [lo] = expectedBand(u.grade, monthsIntoGrade(u))
    if (m !== null && last10.length >= 5 && m < lo - 0.25)
      out.push({ level: 'warning', residentId: u.id, title: `Por debajo de lo esperado para ${u.grade}`, detail: `Supervisión promedio ${m.toFixed(1)} vs. ${lo.toFixed(1)} esperado` })
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1))
}

/** Promedio móvil simple sobre una serie ordenada */
export function rolling(values: number[], w: number) {
  return values.map((_, i) => {
    const s = values.slice(Math.max(0, i - w + 1), i + 1)
    return s.reduce((a, b) => a + b, 0) / s.length
  })
}
