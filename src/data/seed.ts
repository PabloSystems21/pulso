// Generador determinista de historial simulado (sin backend).
// Cada residente tiene una "curva" de habilidad y una curva de aprendizaje por procedimiento,
// así las gráficas y la CUSUM se ven como se verían con datos reales.
import type {
  AnesthesiaType,
  Area,
  Asa,
  CaseRecord,
  Evaluation,
  Grade,
  HelpLevel,
  ProcedureRecord,
  ProcedureType,
  Score4,
  Score5,
  Shift,
  User,
} from '../types'
import { addDays, daysBetween, toISODate } from '../lib/dates'
import { ANTS_ITEMS, MINICEX_ITEMS } from './catalog'
import { ATTENDINGS, PROFESORES, RESIDENTS, residencyStart } from './users'

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
  '26104': { s0: 0.12, s1: 1, tau: 280, talent: 0.35, load: 1.1 }, // Pablo Rodríguez
  '26118': { s0: 0.08, s1: 0.75, tau: 380, talent: 1.2, load: 1 }, // Daniela Cruz
  '25073': { s0: 0.1, s1: 0.8, tau: 400, talent: 1.1, load: 0.75 }, // Jorge Salinas
  '25089': { s0: 0.12, s1: 0.95, tau: 380, talent: 0.8, load: 0.75 }, // Valeria Mendoza
  '24035': { s0: 0.1, s1: 0.95, tau: 400, talent: 0.8, load: 0.55 }, // Andrés Fuentes
  '24042': { s0: 0.1, s1: 0.86, tau: 420, talent: 1, load: 0.55 }, // Regina Lara
}

/** Curva de aprendizaje por procedimiento: pFalla(k) = pEnd + (pStart − pEnd)·e^(−k/K) */
const LEARN: Record<ProcedureType, { pStart: number; pEnd: number; K: number }> = {
  laringoscopia: { pStart: 0.35, pEnd: 0.03, K: 10 },
  mascarilla: { pStart: 0.15, pEnd: 0.01, K: 5 },
  videolaringo: { pStart: 0.2, pEnd: 0.03, K: 5 },
  fibroscopio: { pStart: 0.5, pEnd: 0.1, K: 4 },
  espinal: { pStart: 0.35, pEnd: 0.03, K: 10 },
  epidural: { pStart: 0.4, pEnd: 0.05, K: 8 },
  mixto: { pStart: 0.45, pEnd: 0.06, K: 8 },
  arterial: { pStart: 0.35, pEnd: 0.06, K: 6 },
  cvc: { pStart: 0.4, pEnd: 0.05, K: 5 },
  periferico: { pStart: 0.35, pEnd: 0.06, K: 6 },
  otro: { pStart: 0.3, pEnd: 0.1, K: 6 },
}

const BLOCK_LABELS = ['Interescalénico', 'Supraclavicular', 'Axilar', 'Femoral', 'Ciático poplíteo', 'TAP', 'Erector espinal']

const INCIDENT_BY_PROC: Partial<Record<ProcedureType, string[]>> = {
  laringoscopia: ['Desaturación < 90%', 'Intubación esofágica', 'Trauma dental / vía aérea'],
  videolaringo: ['Desaturación < 90%', 'Trauma dental / vía aérea'],
  mascarilla: ['Desaturación < 90%'],
  espinal: ['Parestesia', 'Hipotensión significativa', 'Bloqueo incompleto', 'Raquia masiva'],
  epidural: ['Punción dural', 'Punción vascular inadvertida', 'Bloqueo incompleto'],
  mixto: ['Punción dural', 'Bloqueo incompleto', 'Hipotensión significativa'],
  arterial: ['Hematoma'],
  cvc: ['Punción vascular inadvertida', 'Hematoma', 'Neumotórax'],
  periferico: ['Bloqueo incompleto', 'Parestesia', 'Intoxicación por anestésicos locales'],
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
const COMMENTS = ['Buen caso para su grado.', 'Conviene repetir la técnica esta semana.', 'Se le notó más seguro que en casos previos.', '']
const REFLECTIONS = {
  low: [
    'Me costó la visualización de la glotis, necesito repasar posición.',
    'Tardé en preparar el equipo; la próxima lo dejo listo antes.',
    'Me faltó seguridad al calcular las dosis.',
    'Identifiqué tarde la hipotensión, me la señaló mi adscrito.',
  ],
  mid: [
    'Logré el procedimiento con indicaciones; me falta fluidez.',
    'Me sentí más seguro que la vez pasada, pero tardé de más.',
    'Buen manejo del plan, aunque me costó anticipar el sangrado.',
    'Mi punto débil sigue siendo la referencia anatómica.',
  ],
  high: [
    'Manejé el caso completo sin ayuda; me sentí cómodo.',
    'Buen control hemodinámico durante todo el caso.',
    'Pude anticipar el evento y ajustar el plan a tiempo.',
    'Apoyé al R1 durante el caso y salió bien.',
  ],
}
const CRITICAL_NOTES = [
  'Hipotensión sostenida posterior al bloqueo, requirió vasopresor en infusión.',
  'Desaturación durante la inducción, se resolvió con ventilación a dos manos.',
  'Sangrado mayor al esperado, se activó protocolo de transfusión.',
  'Broncoespasmo intraoperatorio, se profundizó plano anestésico.',
  'Cambio no previsto de técnica quirúrgica, se reconvirtió el plan anestésico.',
]
const RISK_NOTES = [
  'Retraso en reconocer la desaturación; el adscrito tuvo que tomar la vía aérea.',
  'Dosis calculada por arriba de lo indicado, se corrigió antes de administrarla.',
  'No verificó el equipo de vía aérea antes de iniciar.',
]

function gradeAt(residencyStartDate: Date, date: Date): Grade {
  const years = Math.floor(daysBetween(toISODate(residencyStartDate), toISODate(date)) / 365.25)
  return (['R1', 'R2', 'R3'] as const)[clamp(years, 0, 2)]
}

interface Ctx {
  r: Rng
  prof: Profile
  skill: number
  counts: Partial<Record<ProcedureType, number>>
  caseId: string
  seq: { n: number }
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
  return {
    id: `${ctx.caseId}-p${++ctx.seq.n}`,
    type,
    label: type === 'periferico' ? pick(r, BLOCK_LABELS) : undefined,
    firstOperator,
    success,
    attempts,
    time,
    help,
    incidents,
  }
}

function proceduresFor(ctx: Ctx, anesthesia: AnesthesiaType, asa: Asa, vad: boolean, allowCvc: boolean): ProcedureRecord[] {
  const { r } = ctx
  const list: ProcedureType[] = []
  const add = (t: ProcedureType) => {
    if (!list.includes(t)) list.push(t) // nunca se repite un procedimiento en el mismo caso
  }
  const airway = () => {
    if (vad && chance(r, 0.25)) add('fibroscopio')
    else add(chance(r, 0.12) ? 'videolaringo' : 'laringoscopia')
    if (chance(r, 0.3)) add('mascarilla')
  }
  if (anesthesia === 'general') {
    airway()
    if (asa >= 3 && chance(r, 0.4)) add('arterial')
    if (asa >= 3 && allowCvc && chance(r, 0.22)) add('cvc')
  } else if (anesthesia === 'regional') {
    add(weighted(r, [['espinal', 55], ['epidural', 22], ['mixto', 12], ['periferico', 11]]))
    if (chance(r, 0.12)) add('periferico')
  } else if (anesthesia === 'combinada') {
    add(weighted(r, [['epidural', 45], ['mixto', 30], ['periferico', 25]]))
    airway()
  } else if (chance(r, 0.4)) add('mascarilla')
  return list.map((t) => makeProcedure(ctx, t))
}

const score5 = (r: Rng, skill: number, bias = 0, noObs = 0): Score5 =>
  chance(r, noObs) ? null : (clamp(Math.round(1 + 4 * skill + bias + gauss(r) * 0.55), 1, 5) as Score5)
const score4 = (r: Rng, skill: number, noObs = 0): Score4 =>
  chance(r, noObs) ? null : (clamp(Math.round(1 + 3 * skill + gauss(r) * 0.5), 1, 4) as Score4)

function makeEvaluation(r: Rng, c: CaseRecord, evaluator: User, skill: number, penalty: number, forceReview: boolean): Evaluation {
  // O-SCORE por procedimiento
  const supervision: Evaluation['supervision'] = {}
  let sum = 0
  c.procedures.forEach((p) => {
    const hit = (p.success ? 0 : 1.2) + (p.attempts > 2 ? 0.6 : 0) + (p.help >= 3 ? 0.8 : 0)
    const v = clamp(Math.round(1 + 4 * skill - penalty - hit + gauss(r) * 0.4), 1, 5) as 1 | 2 | 3 | 4 | 5
    supervision[p.id] = v
    sum += v
  })
  const mean = c.procedures.length ? sum / c.procedures.length : clamp(1 + 4 * skill - penalty, 1, 5)
  const ent = clamp(Math.round(mean + gauss(r) * 0.5 - 0.15), 1, 5) as Evaluation['entrustment']
  const level = mean <= 2.2 ? 'low' : mean >= 3.8 ? 'high' : 'mid'
  const ants: Record<string, Score4> = {}
  ANTS_ITEMS.forEach((i) => (ants[i.id] = score4(r, skill, 0.05)))
  const miniCex: Record<string, Score5> = {}
  MINICEX_ITEMS.forEach((i) => (miniCex[i.id] = score5(r, skill, -penalty / 2, 0.04)))
  const risk = c.procedures.some((p) => p.incidents.length) && chance(r, 0.12)
  return {
    attendingId: evaluator.id,
    evaluatedAt: `${c.date}T${String(clamp(Number(c.startTime.slice(0, 2)) + 3, 0, 23)).padStart(2, '0')}:${c.startTime.slice(3)}:00`,
    durationSec: 150 + Math.round(r() * 170),
    supervision,
    entrustment: ent,
    ants,
    miniCex,
    best: pick(r, BEST[level]),
    improve: pick(r, IMPROVE[level]),
    comments: chance(r, 0.35) ? pick(r, COMMENTS) || undefined : undefined,
    needsProfessorReview: forceReview || risk || chance(r, 0.015),
    patientRisk: risk,
    patientRiskNote: risk ? pick(r, RISK_NOTES) : undefined,
  }
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
        const caseId = `${res.id}-${idx++}`
        // Daniela: racha reciente de problemas en bloqueo espinal (el "peor caso" del demo)
        const danielaStreak = res.id === '26118' && daysAgo <= 21
        const area: Area = danielaStreak && chance(r, 0.7) ? 'toco' : weighted(r, [['quirofano', 68], ['toco', 14], ['fuera', 18]])
        const anesthesia: AnesthesiaType =
          area === 'toco'
            ? weighted(r, [['regional', 80], ['general', 20]])
            : area === 'fuera'
              ? weighted(r, [['sedacion', 70], ['general', 30]])
              : weighted(r, [['general', 68], ['regional', 20], ['combinada', 12]])
        const asaW: Record<Grade, [Asa, number][]> = {
          R1: [[1, 26], [2, 44], [3, 22], [4, 6], [5, 1.5], [6, 0.5]],
          R2: [[1, 18], [2, 40], [3, 28], [4, 10], [5, 3], [6, 1]],
          R3: [[1, 12], [2, 33], [3, 33], [4, 15], [5, 5], [6, 2]],
        }
        const asa = weighted(r, asaW[grade])
        const shift: Shift = guardia ? 'guardia' : 'ordinaria'
        const urgency = chance(r, shift === 'guardia' ? 0.7 : 0.15) ? 'urgente' : 'electivo'
        const comorbidities: string[] = []
        if (area === 'toco') comorbidities.push('Embarazo')
        if (chance(r, 0.2)) comorbidities.push('Obesidad')
        const vad = chance(r, asa >= 4 ? 0.18 : 0.06)
        if (vad) comorbidities.push('Vía aérea difícil prevista')
        if (area !== 'toco' && chance(r, 0.08)) comorbidities.push('Paciente pediátrico')
        const criticalEvent = chance(r, asa >= 4 ? 0.22 : 0.08)
        const allowCvc = !(res.id === '26104' && (daysAgo < 41 || dayN < 50))
        const seq = { n: 0 }
        const ctx: Ctx = { r, prof, skill, counts, caseId, seq, forceFail: danielaStreak ? (t) => t === 'espinal' : undefined }
        const procedures = proceduresFor(ctx, anesthesia, asa, vad, allowCvc)
        // A veces no hubo adscrito presente: eso dispara alerta a todos los profesores
        const noAttending = chance(r, 0.022)
        const attendingId = noAttending ? null : weighted(r, ATTENDINGS.map((a) => [a.id, a.profesor ? 20 : 10] as [string, number]))
        const hh = shift === 'guardia' ? 16 + Math.floor(r() * 7) : j === 0 ? 7 + Math.floor(r() * 2) : 11 + Math.floor(r() * 3)
        const level = skill <= 0.35 ? 'low' : skill >= 0.7 ? 'high' : 'mid'
        const c: CaseRecord = {
          id: caseId,
          residentId: res.id,
          attendingId,
          supervisionGap: noAttending ? (chance(r, 0.6) ? 'residente-mayor' : 'solo') : undefined,
          createdAt: `${dateISO}T${String(hh + 2).padStart(2, '0')}:00:00`,
          date: dateISO,
          startTime: `${String(hh).padStart(2, '0')}:${pick(r, ['00', '15', '30', '45'])}`,
          area,
          shift,
          grade,
          urgency,
          asa,
          anesthesia,
          comorbidities,
          usualForGrade: !chance(r, 0.1),
          criticalEvent,
          criticalEventNote: criticalEvent ? pick(r, CRITICAL_NOTES) : undefined,
          procedures,
          residentReflection: pick(r, REFLECTIONS[level]),
          residentNote: chance(r, 0.12) ? 'Quiero repasar este tema en la sesión.' : undefined,
          status: 'evaluado',
        }
        const penalty = asa >= 4 ? 0.6 : asa === 3 ? 0.25 : 0
        const espinalFail = danielaStreak && procedures.some((p) => p.type === 'espinal' && (!p.success || p.help >= 3))
        // Los casos sin adscrito los termina revisando un profesor; los muy recientes quedan pendientes
        const evaluator = noAttending ? pick(r, PROFESORES) : ATTENDINGS.find((a) => a.id === attendingId)!
        if (noAttending && daysAgo <= 10) {
          c.status = 'pendiente'
        } else {
          c.evaluation = makeEvaluation(r, c, evaluator, skill, penalty, espinalFail)
          if (espinalFail) c.evaluation.improve = 'Revisar referencias anatómicas y posición antes de puncionar'
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
  const base = { status: 'pendiente' as const, usualForGrade: true, criticalEvent: false }
  return [
    {
      ...base,
      id: 'pend-dcruz',
      residentId: '26118',
      attendingId: '10482',
      createdAt: `${t}T09:40:00`,
      date: t,
      startTime: '08:00',
      area: 'toco',
      shift: 'ordinaria',
      grade: 'R1',
      urgency: 'urgente',
      asa: 2,
      anesthesia: 'regional',
      comorbidities: ['Embarazo', 'Obesidad'],
      procedures: [
        { id: 'pend-dcruz-p1', type: 'espinal', firstOperator: true, success: true, attempts: 3, time: '>10', help: 2, incidents: ['Parestesia'] },
      ],
      residentReflection: 'Me costó encontrar el espacio; necesito repasar referencias anatómicas en paciente con obesidad.',
      residentNote: 'Paciente con IMC 38. Al tercer intento lo logré con ayuda del Dr.',
    },
    {
      ...base,
      id: 'pend-jsalinas',
      residentId: '25073',
      attendingId: '10482',
      createdAt: `${y}T15:10:00`,
      date: y,
      startTime: '11:30',
      area: 'quirofano',
      shift: 'ordinaria',
      grade: 'R2',
      urgency: 'electivo',
      asa: 3,
      anesthesia: 'combinada',
      comorbidities: [],
      procedures: [
        { id: 'pend-jsalinas-p1', type: 'epidural', firstOperator: true, success: true, attempts: 1, time: '5-10', help: 0, incidents: [] },
        { id: 'pend-jsalinas-p2', type: 'arterial', firstOperator: true, success: true, attempts: 2, time: '5-10', help: 1, incidents: [] },
      ],
      residentReflection: 'La epidural salió al primer intento; la línea arterial me tomó dos punciones.',
    },
    {
      ...base,
      id: 'pend-rlara',
      residentId: '24042',
      attendingId: '10603',
      createdAt: `${t}T10:20:00`,
      date: t,
      startTime: '07:30',
      area: 'quirofano',
      shift: 'ordinaria',
      grade: 'R3',
      urgency: 'electivo',
      asa: 3,
      anesthesia: 'general',
      comorbidities: ['Vía aérea difícil prevista'],
      procedures: [
        { id: 'pend-rlara-p1', type: 'videolaringo', firstOperator: true, success: true, attempts: 1, time: '<5', help: 0, incidents: [] },
        { id: 'pend-rlara-p2', type: 'arterial', firstOperator: true, success: true, attempts: 1, time: '<5', help: 0, incidents: [] },
      ],
      residentReflection: 'Preparé plan B y C de vía aérea; todo salió conforme al plan.',
    },
    {
      // Caso sin adscrito: alerta para TODOS los profesores
      ...base,
      id: 'pend-vmendoza-sin',
      residentId: '25089',
      attendingId: null,
      supervisionGap: 'residente-mayor',
      createdAt: `${y}T23:10:00`,
      date: y,
      startTime: '22:40',
      area: 'toco',
      shift: 'guardia',
      grade: 'R2',
      urgency: 'urgente',
      asa: 2,
      anesthesia: 'regional',
      comorbidities: ['Embarazo'],
      criticalEvent: true,
      criticalEventNote: 'Hipotensión sostenida tras el bloqueo; se manejó con efedrina en bolos.',
      procedures: [
        { id: 'pend-vmendoza-sin-p1', type: 'espinal', firstOperator: true, success: true, attempts: 2, time: '5-10', help: 0, incidents: ['Hipotensión significativa'] },
      ],
      residentReflection: 'Cesárea urgente de madrugada; no había adscrito disponible y me apoyó el R3 de guardia.',
    },
  ]
}

let cache: CaseRecord[] | null = null
export function getSeed(): CaseRecord[] {
  if (!cache) cache = buildSeed()
  return cache
}
