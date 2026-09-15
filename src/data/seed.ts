// Generador determinista de historial simulado (sin backend).
// Cada residente tiene una "curva" de habilidad y una curva de aprendizaje por procedimiento,
// así las gráficas y la CUSUM se ven como se verían con datos reales.
import type {
  AnesthesiaType,
  CaseRecord,
  Complexity,
  CriticalEvent,
  Evaluation,
  Grade,
  HelpLevel,
  ProcedureRecord,
  ProcedureType,
  Score4,
  Score5,
  Shift,
} from '../types'
import { addDays, daysBetween, toISODate } from '../lib/dates'
import { ANTS_ITEMS, GLOBAL_ITEMS, MINICEX_ITEMS, PROF_ITEMS, ROOMS, SPECIALTIES } from './catalog'
import { ATTENDINGS, RESIDENTS, residencyStart } from './users'

type Rng = () => number

function mulberry32(a: number): Rng {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: Rng, arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
const chance = (r: Rng, p: number) => r() < p
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
function gauss(r: Rng) {
  let u = 0
  let v = 0
  while (u === 0) u = r()
  while (v === 0) v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function weighted<T>(r: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [v, w] of items) {
    x -= w
    if (x <= 0) return v
  }
  return items[items.length - 1][0]
}

interface Profile {
  s0: number
  s1: number
  tau: number // días
  talent: number // multiplica la tasa de falla final (menor = mejor)
  load: number // multiplica la carga de casos evaluados
}

const PROFILES: Record<string, Profile> = {
  prodriguez: { s0: 0.12, s1: 1, tau: 300, talent: 0.7, load: 1 },
  dcruz: { s0: 0.08, s1: 0.75, tau: 380, talent: 1.2, load: 1 },
  jsalinas: { s0: 0.1, s1: 0.8, tau: 400, talent: 1.1, load: 0.75 },
  vmendoza: { s0: 0.12, s1: 0.95, tau: 380, talent: 0.8, load: 0.75 },
  afuentes: { s0: 0.1, s1: 0.95, tau: 400, talent: 0.8, load: 0.55 },
  rlara: { s0: 0.1, s1: 0.86, tau: 420, talent: 1, load: 0.55 },
}

/** Curva de aprendizaje por procedimiento: pFalla(k) = pEnd + (pStart − pEnd)·e^(−k/K) */
const LEARN: Record<ProcedureType, { pStart: number; pEnd: number; K: number }> = {
  iot: { pStart: 0.4, pEnd: 0.03, K: 12 },
  mascarilla: { pStart: 0.15, pEnd: 0.01, K: 5 },
  videolaringo: { pStart: 0.2, pEnd: 0.03, K: 5 },
  fibroscopio: { pStart: 0.5, pEnd: 0.1, K: 4 },
  neuroaxial: { pStart: 0.35, pEnd: 0.03, K: 10 },
  epidural: { pStart: 0.4, pEnd: 0.05, K: 8 },
  arterial: { pStart: 0.35, pEnd: 0.06, K: 6 },
  cvc: { pStart: 0.4, pEnd: 0.05, K: 5 },
  periferico: { pStart: 0.35, pEnd: 0.06, K: 6 },
  otro: { pStart: 0.3, pEnd: 0.1, K: 6 },
}

const SPEC_WEIGHTS: [string, number][] = [
  ['cg', 25], ['go', 18], ['orto', 15], ['uro', 8], ['neuro', 5], ['cct', 3],
  ['ped', 7], ['orl', 5], ['oft', 4], ['plas', 4], ['vasc', 4], ['fuera', 2],
]

const INCIDENT_BY_PROC: Partial<Record<ProcedureType, string[]>> = {
  iot: ['Desaturación < 90%', 'Intubación esofágica', 'Trauma dental / vía aérea'],
  videolaringo: ['Desaturación < 90%', 'Trauma dental / vía aérea'],
  mascarilla: ['Desaturación < 90%'],
  neuroaxial: ['Parestesia', 'Hipotensión significativa', 'Bloqueo incompleto'],
  epidural: ['Punción dural', 'Punción vascular inadvertida', 'Bloqueo incompleto'],
  arterial: ['Hematoma'],
  cvc: ['Punción vascular inadvertida', 'Hematoma', 'Neumotórax'],
  periferico: ['Bloqueo incompleto', 'Parestesia'],
  fibroscopio: ['Desaturación < 90%'],
}

const BEST = {
  low: ['Buena disposición y actitud de aprendizaje', 'Preparó el equipo completo antes de iniciar', 'Monitorización completa y a tiempo', 'Pidió ayuda oportunamente, sin dudar', 'Checklist completo antes de la inducción'],
  mid: ['Plan anestésico claro y bien fundamentado', 'Buena comunicación con cirugía y enfermería', 'Técnica aséptica impecable', 'Inducción fluida y bien dosificada', 'Anticipó la hipotensión post-bloqueo', 'Preoxigenación y posición de olfateo óptimas'],
  high: ['Condujo el caso de forma independiente y segura', 'Excelente liderazgo en la sala', 'Enseñó al R1 durante el caso con mucha claridad', 'Manejo impecable del evento crítico', 'Excelente juicio al cambiar el plan a tiempo'],
}
const IMPROVE = {
  low: ['Revisar anatomía de la vía aérea y posición de olfateo', 'Verbalizar el plan al equipo antes de actuar', 'Mejorar tiempos de preparación del equipo', 'Repasar farmacología de inductores y relajantes', 'Revisar referencias anatómicas antes de puncionar'],
  mid: ['Anticipar plan B/C de vía aérea', 'Ajustar dosis a comorbilidades', 'Reevaluar después de cada intervención', 'Optimizar analgesia multimodal', 'Priorizar mejor ante cambios del caso'],
  high: ['Profundizar en manejo de casos de alta complejidad', 'Delegar más y supervisar al residente menor', 'Presentar este caso en la sesión académica'],
}
const PLANS = ['Repetir la técnica con supervisión directa', 'Leer guía DAS de vía aérea difícil', 'Practicar en simulador esta semana', 'Revisar el caso juntos en la sesión del jueves', 'Traer el plan anestésico escrito al siguiente caso']
const NOTES = ['Me costó la visualización de la glotis, Cormack III', 'Paciente con cuello corto, primer intento fallido', 'Me sentí más seguro que la vez pasada', 'Quiero repasar dosis de vasopresores', '']

function gradeAt(residencyStartDate: Date, date: Date): Grade {
  const years = Math.floor(daysBetween(toISODate(residencyStartDate), toISODate(date)) / 365.25)
  return (['R1', 'R2', 'R3'] as const)[clamp(years, 0, 2)]
}

let procSeq = 0
const pid = () => `p${++procSeq}`

interface Ctx {
  r: Rng
  prof: Profile
  skill: number
  counts: Partial<Record<ProcedureType, number>>
  forceFail?: (t: ProcedureType) => boolean
}

function makeProcedure(ctx: Ctx, type: ProcedureType): ProcedureRecord {
  const { r, prof, skill, counts } = ctx
  const k = counts[type] ?? 0
  counts[type] = k + 1
  const L = LEARN[type]
  const pEnd = L.pEnd * prof.talent
  let pFail = pEnd + (L.pStart - pEnd) * Math.exp(-k / L.K)
  if (ctx.forceFail?.(type)) pFail = 0.85
  const firstOperator = !chance(r, 0.04)
  const fail = chance(r, pFail)
  let success = true
  let attempts: ProcedureRecord['attempts'] = 1
  let help: HelpLevel = 0
  if (!firstOperator) {
    help = 3
    attempts = pick(r, [1, 2] as const)
  } else if (fail) {
    const kind = r()
    if (kind < 0.4) {
      success = false
      attempts = pick(r, [2, 3, 4] as const)
      help = 4
    } else if (kind < 0.75) {
      attempts = pick(r, [3, 4] as const)
      help = pick(r, [1, 2] as const)
    } else {
      attempts = 2
      help = 3
    }
  } else {
    attempts = chance(r, 0.78 + skill * 0.15) ? 1 : 2
    help = chance(r, 0.85 - skill) ? (chance(r, 0.2) ? 2 : 1) : 0
  }
  const time = fail ? (chance(r, 0.6) ? '>10' : '5-10') : chance(r, 0.3 + skill * 0.5) ? '<5' : chance(r, 0.8) ? '5-10' : '>10'
  const pool = INCIDENT_BY_PROC[type] ?? []
  const incidents = pool.length && chance(r, fail ? 0.4 : 0.03) ? [pick(r, pool)] : []
  return { id: pid(), type, firstOperator, success, attempts, time, help, safety: !chance(r, 0.03), incidents }
}

function proceduresFor(ctx: Ctx, anesthesia: AnesthesiaType, complexity: Complexity, surgery: string, vad: boolean, allowCvc: boolean): ProcedureRecord[] {
  const { r } = ctx
  const list: ProcedureType[] = []
  const airway = () => {
    if (vad && chance(r, 0.25)) list.push('fibroscopio')
    else list.push(chance(r, 0.12) ? 'videolaringo' : 'iot')
    if (chance(r, 0.3)) list.unshift('mascarilla')
  }
  if (anesthesia === 'general') {
    airway()
    if (complexity === 'alta' && chance(r, 0.55)) list.push('arterial')
    if (complexity !== 'baja' && allowCvc && chance(r, complexity === 'alta' ? 0.35 : 0.06)) list.push('cvc')
  } else if (anesthesia === 'regional') {
    if (surgery === 'Cesárea' || chance(r, 0.6)) list.push('neuroaxial')
    else if (chance(r, 0.5)) list.push('epidural')
    else list.push('periferico')
  } else if (anesthesia === 'combinada') {
    list.push(chance(r, 0.6) ? 'epidural' : 'periferico')
    airway()
  } else if (chance(r, 0.4)) list.push('mascarilla')
  return list.map((t) => makeProcedure(ctx, t))
}

const score5 = (r: Rng, skill: number, bias = 0, noObs = 0): Score5 =>
  chance(r, noObs) ? null : (clamp(Math.round(1 + 4 * skill + bias + gauss(r) * 0.55), 1, 5) as Score5)
const score4 = (r: Rng, skill: number, noObs = 0): Score4 =>
  chance(r, noObs) ? null : (clamp(Math.round(1 + 3 * skill + gauss(r) * 0.5), 1, 4) as Score4)

function makeEvaluation(r: Rng, c: CaseRecord, skill: number, complexityPenalty: number, extra: { followUp?: Evaluation['followUp'] }): Evaluation {
  const att = ATTENDINGS.find((a) => a.id === c.attendingId)!
  const full = !!att.teachingTeam && chance(r, 0.3)
  const sup = clamp(Math.round(1 + 4 * skill - complexityPenalty + gauss(r) * 0.45), 1, 5) as Evaluation['supervision']
  const ent = clamp(Math.round(sup + gauss(r) * 0.5 - 0.15), 1, 5) as Evaluation['entrustment']
  const level = sup <= 2 ? 'low' : sup >= 4 ? 'high' : 'mid'
  const ants: Record<string, Score4> = {}
  ANTS_ITEMS.filter((i) => full || i.short).forEach((i) => (ants[i.id] = score4(r, skill, 0.05)))
  const miniCex: Record<string, Score5> = {}
  MINICEX_ITEMS.filter((i) => full || i.short).forEach((i) => (miniCex[i.id] = score5(r, skill, -complexityPenalty / 2, 0.04)))
  const ev: Evaluation = {
    version: full ? 'completa' : 'corta',
    attendingId: c.attendingId,
    evaluatedAt: `${c.date}T${String(clamp(Number(c.startTime.slice(0, 2)) + 3, 0, 23)).padStart(2, '0')}:${c.startTime.slice(3)}:00`,
    durationSec: full ? 240 + Math.round(r() * 200) : 70 + Math.round(r() * 90),
    supervision: sup,
    entrustment: ent,
    ants,
    miniCex,
    best: pick(r, BEST[level]),
    improve: pick(r, IMPROVE[level]),
    plan: chance(r, 0.35) ? pick(r, PLANS) : undefined,
    countsForProgression: !chance(r, 0.04),
    followUp: extra.followUp ?? (sup <= 1 && chance(r, 0.4) ? 'observacion' : 'no'),
    patientRisk: c.procedures.some((p) => p.incidents.length) && chance(r, 0.3) ? 'potencial' : 'no',
    proceduresConfirmed: true,
  }
  if (full) {
    ev.global = {}
    GLOBAL_ITEMS.forEach((i) => (ev.global![i.id] = score5(r, skill, -complexityPenalty / 2, 0.03)))
    ev.professionalism = {}
    PROF_ITEMS.forEach((i) => (ev.professionalism![i.id] = score5(r, Math.min(1, skill + 0.2))))
  }
  return ev
}

function buildSeed(): CaseRecord[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const out: CaseRecord[] = []

  RESIDENTS.forEach((res, ri) => {
    const r = mulberry32(1000 + ri * 7919)
    const prof = PROFILES[res.id]
    const start = residencyStart(res.grade!, now)
    const counts: Ctx['counts'] = {}
    let idx = 0
    for (let d = new Date(start); d < today; d = addDays(d, 1)) {
      const dateISO = toISODate(d)
      const dayN = daysBetween(toISODate(start), dateISO)
      const daysAgo = daysBetween(dateISO, toISODate(today))
      const weekend = d.getDay() === 0 || d.getDay() === 6
      const nCases = weekend
        ? chance(r, 0.2 * prof.load) ? 1 : 0
        : chance(r, 0.52 * prof.load) ? (chance(r, 0.22) ? 2 : 1) : 0
      const guardia = weekend || chance(r, 0.12)
      for (let j = 0; j < nCases; j++) {
        const skill = prof.s0 + (prof.s1 - prof.s0) * (1 - Math.exp(-dayN / prof.tau))
        const grade = gradeAt(start, d)
        // Daniela: racha reciente de problemas en neuroaxial (el "peor caso" del demo)
        const danielaStreak = res.id === 'dcruz' && daysAgo <= 21
        const specId = danielaStreak && chance(r, 0.7) ? 'go' : weighted(r, SPEC_WEIGHTS)
        const spec = SPECIALTIES.find((s) => s.id === specId)!
        const surgery = specId === 'go' && (danielaStreak || chance(r, 0.6)) ? 'Cesárea' : pick(r, spec.surgeries)
        const anesthesia: AnesthesiaType =
          surgery === 'Cesárea'
            ? chance(r, 0.88) ? 'regional' : 'general'
            : specId === 'orto'
              ? weighted(r, [['regional', 45], ['combinada', 25], ['general', 30]])
              : specId === 'uro'
                ? weighted(r, [['regional', 50], ['general', 50]])
                : specId === 'oft' || specId === 'fuera'
                  ? weighted(r, [['sedacion', 70], ['general', 30]])
                  : weighted(r, [['general', 85], ['combinada', specId === 'cg' ? 10 : 3], ['sedacion', 5]])
        const cw: Record<Grade, [Complexity, number][]> = {
          R1: [['baja', 50], ['media', 40], ['alta', 10]],
          R2: [['baja', 30], ['media', 50], ['alta', 20]],
          R3: [['baja', 20], ['media', 45], ['alta', 35]],
        }
        let complexity = weighted(r, cw[grade])
        if ((specId === 'cct' || specId === 'neuro') && complexity === 'baja') complexity = 'media'
        const shift: Shift = guardia ? (weekend ? 'guardia' : pick(r, ['guardia', 'postguardia'] as const)) : 'ordinaria'
        const urgency = chance(r, shift === 'guardia' ? 0.7 : 0.15) ? 'urgente' : 'electivo'
        const asaBase = complexity === 'baja' ? 1 : complexity === 'media' ? 2 : 3
        const asa = clamp(asaBase + (chance(r, 0.45) ? 1 : 0), 1, 5) as CaseRecord['asa']
        const comorbidities: string[] = []
        if (surgery === 'Cesárea') comorbidities.push('Embarazo')
        if (chance(r, 0.2)) comorbidities.push('Obesidad')
        const vad = chance(r, complexity === 'alta' ? 0.18 : 0.06)
        if (vad) comorbidities.push('Vía aérea difícil prevista')
        if (asa >= 3 && chance(r, 0.4)) comorbidities.push(pick(r, ['Cardiopatía', 'Neumopatía']))
        if (urgency === 'urgente' && specId === 'cg' && chance(r, 0.15)) comorbidities.push('Sepsis')
        const criticalEvent = weighted<CriticalEvent>(r, [['no', complexity === 'alta' ? 76 : 90], ['leve', 7], ['moderado', 2.5], ['mayor', 0.5]])
        const allowCvc = !(res.id === 'prodriguez' && (daysAgo < 41 || dayN < 50))
        const ctx: Ctx = { r, prof, skill, counts, forceFail: danielaStreak ? (t) => t === 'neuroaxial' : undefined }
        const procedures = proceduresFor(ctx, anesthesia, complexity, surgery, vad, allowCvc)
        const attendingId = weighted(r, [['fgonzalez', 34], ['mortiz', 22], ['lherrera', 22], ['atrevino', 22]])
        const hh = shift === 'guardia' ? 16 + Math.floor(r() * 7) : j === 0 ? 7 + Math.floor(r() * 2) : 11 + Math.floor(r() * 3)
        const c: CaseRecord = {
          id: `${res.id}-${idx++}`,
          residentId: res.id,
          attendingId,
          createdBy: 'residente',
          createdAt: `${dateISO}T${String(hh + 2).padStart(2, '0')}:00:00`,
          date: dateISO,
          startTime: `${String(hh).padStart(2, '0')}:${pick(r, ['00', '15', '30', '45'])}`,
          room: surgery === 'Cesárea' ? 'Toco' : specId === 'fuera' ? 'Endosc.' : pick(r, ROOMS.slice(0, 8)),
          shift,
          grade,
          specialty: specId,
          surgery,
          urgency,
          asa,
          complexity,
          anesthesia,
          comorbidities,
          usualForGrade: !(grade === 'R1' && complexity === 'alta') && !chance(r, 0.08),
          criticalEvent,
          procedures,
          residentNote: chance(r, 0.15) ? pick(r, NOTES) || undefined : undefined,
          status: 'evaluado',
        }
        const penalty = complexity === 'alta' ? 0.6 : complexity === 'media' ? 0.2 : 0
        const neuroFail = danielaStreak && procedures.some((p) => p.type === 'neuroaxial' && (!p.success || p.help >= 3))
        c.evaluation = makeEvaluation(r, c, skill, penalty, { followUp: neuroFail ? 'repetir' : undefined })
        if (neuroFail) {
          c.evaluation.improve = 'Revisar referencias anatómicas y posición antes de puncionar'
          c.evaluation.plan = 'Repetir bloqueo neuroaxial con supervisión directa'
        }
        out.push(c)
      }
    }
  })

  out.push(...pendingCases(today))
  return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
}

/** Casos que quedan pendientes en la bandeja de los adscritos al abrir el demo */
function pendingCases(today: Date): CaseRecord[] {
  const t = toISODate(today)
  const y = toISODate(addDays(today, -1))
  const base = { createdBy: 'residente' as const, status: 'pendiente' as const, usualForGrade: true, criticalEvent: 'no' as const }
  return [
    {
      ...base,
      id: 'pend-dcruz',
      residentId: 'dcruz',
      attendingId: 'fgonzalez',
      createdAt: `${t}T09:40:00`,
      date: t,
      startTime: '08:00',
      room: 'Toco',
      shift: 'ordinaria',
      grade: 'R1',
      specialty: 'go',
      surgery: 'Cesárea',
      urgency: 'urgente',
      asa: 2,
      complexity: 'media',
      anesthesia: 'regional',
      comorbidities: ['Embarazo', 'Obesidad'],
      procedures: [
        { id: 'pp1', type: 'neuroaxial', firstOperator: true, success: true, attempts: 3, time: '>10', help: 2, safety: true, incidents: ['Parestesia'] },
      ],
      residentNote: 'Me costó encontrar el espacio, la paciente con IMC 38. Al tercer intento con ayuda del Dr.',
    },
    {
      ...base,
      id: 'pend-jsalinas',
      residentId: 'jsalinas',
      attendingId: 'fgonzalez',
      createdAt: `${y}T15:10:00`,
      date: y,
      startTime: '11:30',
      room: 'Q4',
      shift: 'ordinaria',
      grade: 'R2',
      specialty: 'orto',
      surgery: 'Artroplastia de cadera',
      urgency: 'electivo',
      asa: 3,
      complexity: 'alta',
      anesthesia: 'combinada',
      comorbidities: ['Cardiopatía'],
      procedures: [
        { id: 'pp2', type: 'epidural', firstOperator: true, success: true, attempts: 1, time: '5-10', help: 0, safety: true, incidents: [] },
        { id: 'pp3', type: 'arterial', firstOperator: true, success: true, attempts: 2, time: '5-10', help: 1, safety: true, incidents: [] },
      ],
    },
    {
      ...base,
      id: 'pend-rlara',
      residentId: 'rlara',
      attendingId: 'mortiz',
      createdAt: `${t}T10:20:00`,
      date: t,
      startTime: '07:30',
      room: 'Q2',
      shift: 'ordinaria',
      grade: 'R3',
      specialty: 'neuro',
      surgery: 'Craneotomía',
      urgency: 'electivo',
      asa: 3,
      complexity: 'alta',
      anesthesia: 'general',
      comorbidities: [],
      procedures: [
        { id: 'pp4', type: 'iot', firstOperator: true, success: true, attempts: 1, time: '<5', help: 0, safety: true, incidents: [] },
        { id: 'pp5', type: 'arterial', firstOperator: true, success: true, attempts: 1, time: '<5', help: 0, safety: true, incidents: [] },
      ],
    },
  ]
}

let cache: CaseRecord[] | null = null
export function getSeed(): CaseRecord[] {
  if (!cache) cache = buildSeed()
  return cache
}
