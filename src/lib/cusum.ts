import type { ProcedureDef } from '../data/catalog'
import type { ProcedureRecord } from '../types'

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

/** Falla para la curva = no se logró, o excedió intentos, o requirió relevo. */
export function isCusumFailure(p: ProcedureRecord, def: ProcedureDef) {
  return !p.success || p.attempts > def.maxAttempts || p.help >= 3
}

export const CUSUM_RULE = 'Éxito = se logró, ≤ 2 intentos y sin relevo del adscrito'

export interface CusumPoint {
  n: number
  value: number
  fail: boolean
  date: string
  caseId: string
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

export function computeCusum(
  items: { date: string; caseId: string; proc: ProcedureRecord }[],
  def: ProcedureDef,
): CusumResult {
  const params = cusumParams(def)
  const points: CusumPoint[] = []
  let value = 0
  let monitor = 0
  let failures = 0
  let competentAt: number | undefined
  let lastCross: CusumResult['lastCross']

  items.forEach((it, i) => {
    const fail = isCusumFailure(it.proc, def)
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
    points.push({ n, value, fail, date: it.date, caseId: it.caseId })
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
