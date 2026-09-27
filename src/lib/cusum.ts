import type { ProcedureDef } from '../data/catalog'
import type { Grade, ProcedureRecord } from '../types'

/**
 * CUSUM de aprendizaje (Kestin 1995 / Bolsin & Colson 2000).
 *  - Cada falla suma (1 − s); cada éxito resta s.
 *  - h1 (arriba): la tasa de falla es inaceptable (p1).
 *  - h0 (abajo): la tasa de falla es aceptable (p0) → competencia.
 * α = β = 0.10 (convención en anestesia).
 */
export const ALPHA = 0.1
export const BETA = 0.1

export interface CusumParams {
  s: number
  h0: number // negativo
  h1: number
}

export function cusumParams(def: Pick<ProcedureDef, 'p0' | 'p1'>): CusumParams {
  const P = Math.log(def.p1 / def.p0)
  const Q = Math.log((1 - def.p0) / (1 - def.p1))
  const s = Q / (P + Q)
  const a = Math.log((1 - BETA) / ALPHA)
  const b = Math.log((1 - ALPHA) / BETA)
  return { s, h1: a / (P + Q), h0: -b / (P + Q) }
}

/**
 * Éxito = lo hizo el residente, en máx. 2 intentos, SIN que el adscrito tome el control y con el
 * resultado esperado. La tolerancia cambia por grado:
 *  - R1: se entiende que tome más de 2 intentos, más de 10 min o que necesite ayuda. Solo es falla
 *    si no lo logró o si el adscrito tomó el control (relevo, o O-SCORE 1 "lo tuve que hacer yo").
 *  - R2 y R3: además debe ser en ≤ 2 intentos, ≤ 10 min y sin ayuda o solo indicaciones verbales.
 * POR CONFIRMAR: si una complicación con el procedimiento logrado cuenta como falla (hoy no).
 */
export function isCusumFailure(p: ProcedureRecord, def: ProcedureDef, grade: Grade, oscore?: number) {
  if (!p.success) return true
  if (p.help >= 3 || oscore === 1) return true // el adscrito tomó el control
  if (grade === 'R1') return false
  return p.attempts > def.maxAttempts || p.time === '>10' || p.help >= 2
}

export const CUSUM_RULE: Record<Grade, string> = {
  R1: 'Éxito (R1) = lo logró sin que el adscrito tomara el control; se toleran más intentos, tiempo y ayuda',
  R2: 'Éxito (R2) = lo logró en ≤ 2 intentos, ≤ 10 min y sin ayuda o solo indicaciones verbales',
  R3: 'Éxito (R3) = lo logró en ≤ 2 intentos, ≤ 10 min y sin ayuda o solo indicaciones verbales',
}

/** Qué entra a la curva: solo como primer operador y solo si hubo un adscrito que lo supervisó */
export interface CusumItem {
  date: string
  caseId: string
  grade: Grade
  proc: ProcedureRecord
  /** O-SCORE que puso el adscrito (si ya evaluó) */
  oscore?: number
}

export interface CusumPoint {
  n: number
  value: number
  fail: boolean
  date: string
  caseId: string
  grade: Grade
}

export type CusumState = 'sin-datos' | 'curva' | 'competente' | 'alerta'

export interface CusumResult extends CusumParams {
  points: CusumPoint[]
  n: number
  failures: number
  successRate: number
  state: CusumState
  competentAt?: number
  lastCross?: { kind: 'aceptable' | 'inaceptable'; n: number; date: string }
  /** CUSUM de monitoreo (Page, con reinicio en 0): detecta caídas recientes */
  monitor: number
}

export function computeCusum(items: CusumItem[], def: ProcedureDef): CusumResult {
  const params = cusumParams(def)
  const points: CusumPoint[] = []
  let value = 0
  let monitor = 0
  let failures = 0
  let competentAt: number | undefined
  let lastCross: CusumResult['lastCross']

  items.forEach((it, i) => {
    const fail = isCusumFailure(it.proc, def, it.grade, it.oscore)
    const step = fail ? 1 - params.s : -params.s
    const prev = value
    value += step
    monitor = Math.max(0, monitor + step)
    if (fail) failures++
    const n = i + 1
    if (prev > params.h0 && value <= params.h0) {
      lastCross = { kind: 'aceptable', n, date: it.date }
      if (competentAt === undefined) competentAt = n
    }
    if (prev < params.h1 && value >= params.h1) lastCross = { kind: 'inaceptable', n, date: it.date }
    points.push({ n, value, fail, date: it.date, caseId: it.caseId, grade: it.grade })
  })

  const n = items.length
  const recentFails = points.slice(-6).filter((p) => p.fail).length
  let state: CusumState = 'sin-datos'
  if (n > 0) {
    // Alerta = la CUSUM de monitoreo cruzó h1 y hay ≥ 3 fallas en los últimos 6 intentos
    if (n >= 6 && monitor >= params.h1 && recentFails >= 3) state = 'alerta'
    else if (competentAt !== undefined) state = 'competente'
    else state = 'curva'
  }

  return {
    ...params,
    points,
    n,
    failures,
    successRate: n ? (n - failures) / n : 0,
    state,
    competentAt,
    lastCross,
    monitor,
  }
}

export const CUSUM_STATE_LABEL: Record<CusumState, string> = {
  'sin-datos': 'Sin registros',
  curva: 'En curva de aprendizaje',
  competente: 'Competencia alcanzada',
  alerta: 'Alerta: caída de desempeño',
}
