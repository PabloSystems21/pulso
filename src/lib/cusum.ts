import type { ProcedureDef } from '../data/catalog'
import type { Grade } from '../types'

/**
 * CUSUM de aprendizaje, método estándar (Aguirre Ospina et al. 2014, tabla 1; Chang y McLean 2006):
 *  P = ln(p1/p0) · Q = ln((1−p0)/(1−p1)) · s = Q/(P+Q)
 *  a = ln((1−β)/α) · b = ln((1−α)/β) · H1 = a/(P+Q) · H0 = −b/(P+Q)
 *  Cada éxito resta s; cada fallo suma (1 − s).
 *  Cruzar H0 hacia abajo = alcanzó el estándar. Cruzar H1 hacia arriba = tasa de fallo mayor a la
 *  inaceptable → alerta FORMATIVA, solo después del periodo de gracia.
 * Casos mínimos para concluir = |H0 / (s − p0)| (se recalculan solos si cambian los parámetros).
 * Verificado contra la secuencia de prueba de la lista de cotejo (hoja "Prueba CUSUM").
 */

export interface CusumParams {
  s: number
  h0: number // negativo
  h1: number
  /** Número mínimo de intentos para poder concluir */
  minCases: number
}

type Params = { p0: number; p1: number; alfa: number; beta: number }

export function cusumParams(def: Params): CusumParams {
  const P = Math.log(def.p1 / def.p0)
  const Q = Math.log((1 - def.p0) / (1 - def.p1))
  const s = Q / (P + Q)
  const a = Math.log((1 - def.beta) / def.alfa)
  const b = Math.log((1 - def.alfa) / def.beta)
  const h1 = a / (P + Q)
  const h0 = -b / (P + Q)
  return { s, h1, h0, minCases: Math.round(Math.abs(h0 / (s - def.p0))) }
}

/** Lo que entra a la curva: el resultado ya decidido (éxito/fallo validado) */
export interface CusumItem {
  date: string
  caseId: string
  grade: Grade
  fail: boolean
}

export interface CusumPoint {
  n: number
  value: number
  fail: boolean
  date: string
  caseId: string
  grade: Grade
}

export type CusumState = 'sin-datos' | 'insuficiente' | 'curva' | 'estandar' | 'alerta'

export interface CusumResult extends CusumParams {
  points: CusumPoint[]
  n: number
  failures: number
  successRate: number
  state: CusumState
  /** Intento en que cruzó H0 hacia abajo por primera vez */
  competentAt?: number
  lastCross?: { kind: 'aceptable' | 'inaceptable'; n: number; date: string }
  /** Intento en que se activó la alerta formativa (cruce de H1 ya fuera del periodo de gracia) */
  alertAt?: number
  grace: number
}

export function computeCusum(items: CusumItem[], def: Params & Pick<ProcedureDef, 'periodoGracia'>, grace = def.periodoGracia): CusumResult {
  const params = cusumParams(def)
  const points: CusumPoint[] = []
  let value = 0
  let failures = 0
  let competentAt: number | undefined
  let lastCross: CusumResult['lastCross']
  let alertAt: number | undefined

  items.forEach((it, i) => {
    const step = it.fail ? 1 - params.s : -params.s
    const prev = value
    value += step
    if (it.fail) failures++
    const n = i + 1
    if (prev > params.h0 && value <= params.h0) {
      lastCross = { kind: 'aceptable', n, date: it.date }
      if (competentAt === undefined) competentAt = n
    }
    if (prev < params.h1 && value >= params.h1) lastCross = { kind: 'inaceptable', n, date: it.date }
    // Al inicio del aprendizaje es esperable estar arriba de H1: la alerta solo cuenta pasada la gracia
    if (value >= params.h1 && n > grace && alertAt === undefined) alertAt = n
    if (value < params.h1) alertAt = undefined
    points.push({ n, value, fail: it.fail, date: it.date, caseId: it.caseId, grade: it.grade })
  })

  const n = items.length
  let state: CusumState = 'sin-datos'
  if (n > 0) {
    if (alertAt !== undefined) state = 'alerta'
    else if (competentAt !== undefined) state = 'estandar'
    else if (n < params.minCases) state = 'insuficiente'
    else state = 'curva'
  }

  return { ...params, points, n, failures, successRate: n ? (n - failures) / n : 0, state, competentAt, lastCross, alertAt, grace }
}

export const CUSUM_STATE_LABEL: Record<CusumState, string> = {
  'sin-datos': 'Sin registros validados',
  insuficiente: 'Insuficiente para concluir',
  curva: 'Sin cruzar límites',
  estandar: 'Alcanzó el estándar',
  alerta: 'Alerta formativa',
}

/** Qué significa cada estado, en lenguaje formativo */
export const CUSUM_STATE_HINT: Record<CusumState, string> = {
  'sin-datos': 'Todavía no hay intentos validados por un adscrito.',
  insuficiente: 'Aún no hay suficientes intentos para interpretar la curva.',
  curva: 'Ya hay suficientes intentos, pero la curva no ha cruzado ningún límite.',
  estandar: 'La curva cruzó el límite inferior (H0): desempeño compatible con el estándar.',
  alerta: 'La curva está arriba del límite superior (H1) pasado el periodo de gracia: proponer acompañamiento y revisarlo en la sesión trimestral.',
}
