// Éxito de un procedimiento. Un mismo estándar para todos los grados: el grado solo cambia cómo se
// leen las alertas. El autorreporte deja el resultado como PROVISIONAL; el resultado definitivo se
// fija cuando el adscrito valida (y puede corregirlo, quedando trazado).
import { HELP, LOGRO, procDef, type ProcedureDef } from '../data/catalog'
import type { CaseRecord, ProcedureRecord } from '../types'

/** Resultado según los criterios del procedimiento (autorreporte + O-SCORE si ya lo hay) */
export function criteriaResult(p: ProcedureRecord, def: ProcedureDef = procDef(p.type), oscore?: number) {
  const c = def.criterios
  const reasons: string[] = []
  if (!p.success) reasons.push('No se logró')
  if (p.attempts > c.maxIntentos) reasons.push(`${p.attempts === 6 ? '6 o más' : p.attempts} intentos (máx. ${c.maxIntentos})`)
  if (p.time === '>10') reasons.push('Más de 10 min')
  else if (c.maxTiempo === '<5' && p.time !== '<5') reasons.push('5 min o más (máx. menos de 5)')
  if (p.help >= 3) reasons.push('Relevo del adscrito')
  else if (c.ayudaMax !== null && p.help > c.ayudaMax) reasons.push(`Ayuda: ${HELP[p.help].label.toLowerCase()}`)
  if (c.logro && p.logro === false) reasons.push(LOGRO[c.logro].fail)
  if (oscore === 1) reasons.push('O-SCORE 1: el adscrito tuvo que hacerlo')
  return { success: reasons.length === 0, reasons }
}

export type OutcomeStatus = 'exito' | 'fallo' | 'provisional' | 'no-cuenta'

export interface Outcome {
  status: OutcomeStatus
  /** Éxito según criterios (en provisional, el que resultaría del autorreporte) */
  success: boolean
  reasons: string[]
  /** Por qué no cuenta (sin adscrito, parcial, no presenciado, rechazado, en revisión) */
  excludedWhy?: string
  /** Corrección del adscrito: resultado según criterios → resultado final */
  override?: { from: boolean; to: boolean; reason: string }
}

type CaseLike = Pick<CaseRecord, 'status' | 'attendingId' | 'evaluation' | 'professorReview'>

/** Marcado "amerita revisión" y un profesor aún no lo incluye */
export const underReview = (c: Pick<CaseRecord, 'evaluation' | 'professorReview'>) =>
  !!c.evaluation?.needsProfessorReview && !c.professorReview?.include

/** Resultado de un procedimiento dentro de su caso: definitivo, provisional o no cuenta */
export function procedureOutcome(p: ProcedureRecord, c: CaseLike): Outcome {
  const e = c.evaluation
  const oscore = e?.supervision[p.id]
  const base = criteriaResult(p, procDef(p.type), oscore)
  const no = (why: string): Outcome => ({ status: 'no-cuenta', ...base, excludedWhy: why })
  if (!c.attendingId) return no('sin adscrito')
  if (c.status === 'rechazado') return no('registro rechazado')
  if (!p.firstOperator) return no('participación parcial')
  if (c.status !== 'evaluado' || !e) return { status: 'provisional', ...base }
  if (e.notWitnessed?.includes(p.id)) return no('el adscrito no lo presenció')
  const ov = e.successOverride?.[p.id]
  const success = ov ? ov.success : base.success
  const out: Outcome = { status: success ? 'exito' : 'fallo', success, reasons: base.reasons }
  if (ov) out.override = { from: base.success, to: ov.success, reason: ov.reason }
  if (underReview(c)) return { ...out, status: 'no-cuenta', excludedWhy: 'en revisión de un profesor' }
  return out
}

/** Intervalo de confianza al 95% de una proporción (método de Wilson) */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0]
  const p = k / n
  const d = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / d
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

/** "62% (IC95% 45–77%)" */
export const rateText = (k: number, n: number) => {
  if (!n) return '—'
  const [lo, hi] = wilson(k, n)
  return `${pct(k / n)} (IC95% ${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`
}

/** Umbral debajo del cual se advierte que el porcentaje es poco estable */
export const SMALL_N = 30
