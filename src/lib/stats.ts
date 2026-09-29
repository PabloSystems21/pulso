import {
  ANTS_DOMAINS,
  ANTS_ITEMS,
  type AntsDomain,
  EXCLUDE_UNDER_REVIEW,
  OSCORE_TARGET,
  PROTOCOL_PROCEDURES,
  REMINDER_DAYS,
  type ProcedureDef,
  hasCurve,
  procDef,
} from '../data/catalog'
import type { CaseRecord, Evaluation, Grade, ProcedureRecord, User } from '../types'
import { computeCusum, type CusumItem, type CusumResult } from './cusum'
import { procedureOutcome, underReview, type Outcome } from './success'
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

/** Marcado "amerita revisión" y un profesor aún no decide incluirlo (o decidió excluirlo) */
export const isExcluded = (c: CaseRecord) => EXCLUDE_UNDER_REVIEW && underReview(c)

/** Casos que alimentan las gráficas: solo validados por el adscrito y no excluidos */
export const chartCases = (cases: CaseRecord[]) => evaluatedOf(cases).filter((c) => !isExcluded(c))

/** Resultado de un procedimiento (éxito / fallo / provisional / no cuenta) */
export const outcomeOf = (p: ProcedureRecord, c: CaseRecord): Outcome => procedureOutcome(p, c)

/** ¿Cuenta para curvas y tasas? Solo con resultado definitivo (validado por el adscrito) */
export const counts = (p: ProcedureRecord, c: CaseRecord) => {
  const s = outcomeOf(p, c).status
  return s === 'exito' || s === 'fallo'
}

export type Attempt = CusumItem & { c: CaseRecord; proc: ProcedureRecord; oscore?: number }

/** Intentos validados de un procedimiento, en orden (lo que entra a curvas y tasas de éxito) */
export function attemptsOf(residentCases: CaseRecord[], type: string): Attempt[] {
  return residentCases.flatMap((c) =>
    c.procedures
      .filter((p) => p.type === type && counts(p, c))
      .map((proc) => ({ c, proc, date: c.date, caseId: c.id, grade: c.grade, fail: outcomeOf(proc, c).status === 'fallo', oscore: c.evaluation?.supervision[proc.id] })),
  )
}

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
  exposure: number // todas las participaciones (incluye provisionales y las que no cuentan)
  /** Intentos validados */
  attempts: Attempt[]
  ok: number
  /** Solo procedimientos activos (con parámetros publicados) */
  cusum: CusumResult | null
  /** Registros esperando validación del adscrito */
  provisional: number
  lastDate?: string
  daysSince?: number
  /** O-SCORE promedio que le han puesto en este procedimiento */
  supervision: number | null
}

export function procedureSummaries(residentCases: CaseRecord[]): ProcSummary[] {
  const today = todayISO()
  const charted = chartCases(residentCases)
  return PROTOCOL_PROCEDURES.map((def) => {
    const all = residentCases.flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((proc) => ({ c, proc })))
    const attempts = attemptsOf(residentCases, def.id)
    const cusum = hasCurve(def) ? computeCusum(attempts, def) : null
    const lastDate = all.length ? all[all.length - 1].c.date : undefined
    const supervision = avg(charted.flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((p) => c.evaluation.supervision[p.id] ?? null)))
    return {
      def,
      exposure: all.length,
      attempts,
      ok: attempts.filter((a) => !a.fail).length,
      cusum,
      provisional: all.filter(({ c, proc }) => outcomeOf(proc, c).status === 'provisional').length,
      lastDate,
      daysSince: lastDate ? daysBetween(lastDate, today) : undefined,
      supervision,
    }
  })
}

export const procLabel = (p: ProcedureRecord) => (p.label && procDef(p.type).pideNombre ? `${procDef(p.type).short}: ${p.label}` : procDef(p.type).label)

// ───────────────────────── Alertas ─────────────────────────
// Lenguaje formativo: las alertas proponen acompañamiento y revisión en la sesión colegiada
// trimestral; no son dictámenes. El grado cambia cómo se leen (en R1 es esperable), no el estándar.

export type AlertLevel = 'critical' | 'warning' | 'info'

export interface Alert {
  level: AlertLevel
  kind: 'cusum' | 'exposicion' | 'riesgo' | 'sin-adscrito' | 'evento-critico' | 'revision' | 'desempeno' | 'sin-validar' | 'rechazo'
  title: string
  detail: string
  residentId?: string
  to?: string
}

const KEY_PROCS = new Set(['laringoscopia', 'espinal', 'epidural', 'arterial', 'cvc'])
const NO_EXPOSURE_DAYS = 40

/** En R1 una alerta de curva es más esperable: se lee como aviso; en R2 y R3, como algo a revisar */
const levelFor = (g: Grade | undefined): AlertLevel => (g === 'R1' ? 'info' : 'warning')

/** Alertas del desempeño de un residente. Solo las ven profesores. */
export function residentAlerts(u: User, residentCases: CaseRecord[], basePath: string): Alert[] {
  const out: Alert[] = []
  for (const s of procedureSummaries(residentCases)) {
    if (s.cusum?.state === 'alerta') {
      out.push({
        level: levelFor(u.grade),
        kind: 'cusum',
        residentId: u.id,
        title: `Acompañamiento sugerido en ${s.def.short}`,
        detail: `La curva CUSUM está arriba del límite superior (desde el intento #${s.cusum.alertAt}) · revisar en la sesión trimestral`,
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
    const lo = OSCORE_TARGET[u.grade]
    if (m !== null && last10.length >= 5 && m < lo - 0.25)
      out.push({
        level: levelFor(u.grade),
        kind: 'desempeno',
        residentId: u.id,
        title: `Revisar en la sesión trimestral: O-SCORE de ${u.grade}`,
        detail: `Promedio ${m.toFixed(1)} en los últimos 10 casos · referencia provisional ≥ ${lo}`,
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
      detail: `${c.supervisionGap === 'residente-mayor' ? 'Con residente de mayor jerarquía' : 'Estuvo solo'} · ${fmtDate(c.date)} · no se evalúa`,
      to: `/a/caso/${c.id}`,
    })
  })

  // El evento crítico SIEMPRE activa alerta, lo reporta el residente al registrar
  cases.filter((c) => c.criticalEvent && recent(c)).forEach((c) => {
    out.push({
      level: 'warning',
      kind: 'evento-critico',
      residentId: c.residentId,
      title: 'Evento crítico',
      detail: `${c.criticalEventNote ?? 'Sin descripción'} · ${fmtDate(c.date)}`,
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

  cases
    .filter((c) => c.status === 'rechazado' && recent(c))
    .forEach((c) =>
      out.push({
        level: 'warning',
        kind: 'rechazo',
        residentId: c.residentId,
        title: 'Registro rechazado por el adscrito',
        detail: `${c.rejection?.reason ?? ''} · ${fmtDate(c.date)}`,
        to: `/a/caso/${c.id}`,
      }),
    )

  // Recordatorio: registros que llevan más del plazo sin validar
  cases
    .filter((c) => c.status === 'pendiente' && c.attendingId && daysBetween(c.date, today) > REMINDER_DAYS)
    .forEach((c) =>
      out.push({
        level: 'info',
        kind: 'sin-validar',
        residentId: c.residentId,
        title: `Sin validar desde hace ${daysBetween(c.date, today)} días`,
        detail: `Pendiente de ${userById(c.attendingId!).short} · ${fmtDate(c.date)}`,
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
