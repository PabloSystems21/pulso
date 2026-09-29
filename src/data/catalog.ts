import type { AnesthesiaType, Area, Asa, AttemptTime, Grade, HelpLevel, ProcedureType, Shift } from '../types'
import PROC_CONFIG from '../config/procedimientos.json'
import UMBRALES from '../config/umbrales.json'

/**
 * Un caso marcado "amerita revisión de un profesor" queda FUERA de las gráficas y de la
 * CUSUM hasta que un profesor decida incluirlo ("no todo cuenta para la progresión").
 */
export const EXCLUDE_UNDER_REVIEW = true

// ───────────────────────── Contexto del caso ─────────────────────────

export const AREAS: { id: Area; label: string }[] = [
  { id: 'quirofano', label: 'Quirófano' },
  { id: 'toco', label: 'Tococirugía' },
  { id: 'fuera', label: 'Fuera de quirófano' },
]
export const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.id, a.label])) as Record<Area, string>

export const SHIFTS: { id: Shift; label: string; hint: string }[] = [
  { id: 'ordinaria', label: 'Ordinaria', hint: 'Matutino' },
  { id: 'complementaria', label: 'Complementaria', hint: 'Vespertino o guardia' },
]
export const SHIFT_LABEL = Object.fromEntries(SHIFTS.map((s) => [s.id, s.label])) as Record<Shift, string>

export const ANESTHESIA: { id: AnesthesiaType; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'regional', label: 'Regional' },
  { id: 'sedacion', label: 'Sedación' },
  { id: 'combinada', label: 'Combinada' },
]
export const ANESTHESIA_LABEL = Object.fromEntries(ANESTHESIA.map((s) => [s.id, s.label])) as Record<AnesthesiaType, string>

export const ASA_OPTIONS: Asa[] = [1, 2, 3, 4, 5, 6]

export const COMORBIDITIES = ['Vía aérea difícil prevista', 'Obesidad', 'Embarazo', 'Paciente pediátrico']

// ───────────────────────── Procedimientos ─────────────────────────

// La tabla vive en src/config/procedimientos.json (se edita sin tocar el código).

/** Criterio de logro sí/no de cada procedimiento */
export type LogroKey = 'sinDesaturacion' | 'bloqueoFuncional' | 'transduccion' | 'retornoVenoso'

export interface SuccessCriteria {
  maxIntentos: number
  /** '<5' = menos de 5 min · '5-10' = hasta 10 min. '> 10 min' siempre es fallo */
  maxTiempo: '<5' | '5-10'
  /** 0 = ninguna · 1 = solo verbal · null = la ayuda no es criterio (el relevo siempre es fallo) */
  ayudaMax: HelpLevel | null
  logro: LogroKey | null
}

export interface ProcedureDef {
  id: ProcedureType
  label: string
  short: string
  /** activo = curva CUSUM y alertas · calibracion = solo tasa de éxito (parámetros por estimar) */
  estado: 'activo' | 'calibracion'
  /** Tasa de fallo aceptable (p0) e inaceptable (p1); null mientras está en calibración */
  p0: number | null
  p1: number | null
  alfa: number
  beta: number
  fuente: string
  criterios: SuccessCriteria
  /** Criterios aún no definidos por enseñanza: se usa un criterio general provisional */
  criteriosProvisionales?: boolean
  /** Intentos antes de que un cruce de H1 dispare la alerta formativa (provisional) */
  periodoGracia: number
  /** Técnica de mayor riesgo: al R1 se le pide un umbral de O-SCORE menor (2–3) */
  altoRiesgo?: boolean
  /** Pide "¿cuál?" en texto libre */
  pideNombre?: boolean
  /** "Otro": no pertenece a los 10 procedimientos del protocolo */
  fueraDeProtocolo?: boolean
}

export const PROCEDURES = PROC_CONFIG.procedimientos as ProcedureDef[]

export const procDef = (id: ProcedureType) => PROCEDURES.find((p) => p.id === id)!

/** Los 10 procedimientos del protocolo (sin "Otro") */
export const PROTOCOL_PROCEDURES = PROCEDURES.filter((p) => !p.fueraDeProtocolo)

/** ¿Tiene curva CUSUM? Solo los activos con parámetros publicados */
export const hasCurve = (d: ProcedureDef): d is ProcedureDef & { p0: number; p1: number } =>
  d.estado === 'activo' && d.p0 !== null && d.p1 !== null

export const LOGRO: Record<LogroKey, { question: string; hint?: string; ok: string; fail: string; inverted?: boolean }> = {
  // inverted: la pregunta es negativa, "Sí" = el criterio NO se cumplió
  sinDesaturacion: { question: '¿Hubo desaturación (SpO₂ < 90%)?', ok: 'Sin desaturación', fail: 'Con desaturación', inverted: true },
  bloqueoFuncional: { question: '¿El bloqueo fue funcional?', hint: 'Funcional = no requirió más que sedación consciente', ok: 'Bloqueo funcional', fail: 'Bloqueo no funcional' },
  transduccion: { question: '¿Se logró una transducción adecuada?', ok: 'Transducción adecuada', fail: 'Sin transducción adecuada' },
  retornoVenoso: { question: '¿Se confirmó el retorno venoso?', ok: 'Retorno venoso confirmado', fail: 'Sin retorno venoso confirmado' },
}

/** Criterios de éxito en texto, para mostrarlos donde se registra y donde se grafica */
export function criteriaText(d: ProcedureDef): string[] {
  const c = d.criterios
  const unit = d.id === 'arterial' || d.id === 'cvc' ? 'punciones' : 'intentos'
  const out = [`${c.maxIntentos} ${unit} o menos`, c.maxTiempo === '<5' ? 'menos de 5 min' : '10 min o menos']
  if (c.ayudaMax !== null) out.push(c.ayudaMax === 0 ? 'sin ayuda' : 'ayuda ninguna o solo verbal')
  if (c.logro) out.push(LOGRO[c.logro].ok.toLowerCase())
  out.push('sin que el adscrito tome el control (O-SCORE 1 o relevo = fallo)')
  return out
}

export const ATTEMPT_TIMES: { id: AttemptTime; label: string }[] = [
  { id: '<5', label: '< 5 min' },
  { id: '5-10', label: '5–10 min' },
  { id: '>10', label: '> 10 min' },
]

export const HELP: { id: HelpLevel; label: string; resident: string }[] = [
  { id: 0, label: 'Ninguna', resident: 'Ninguna, lo hice solo' },
  { id: 1, label: 'Solo verbal', resident: 'Solo indicaciones verbales' },
  { id: 2, label: 'Demostración parcial', resident: 'Me demostraron una parte' },
  { id: 3, label: 'Relevo parcial', resident: 'Me relevaron en una parte' },
  { id: 4, label: 'Relevo completo', resident: 'Lo terminó quien me supervisó' },
]

export const INCIDENT_OTHER = 'Otro'

export const INCIDENTS = [
  // La desaturación se pregunta aparte (criterio de logro de la vía aérea)
  'Intubación esofágica',
  'Trauma dental / vía aérea',
  'Broncoaspiración',
  'Punción dural',
  'Punción vascular inadvertida',
  'Intoxicación por anestésicos locales',
  'Raquia masiva',
  'Parestesia',
  'Hematoma',
  'Neumotórax',
  'Hipotensión significativa',
  'Bloqueo incompleto',
  INCIDENT_OTHER,
]

// ───────────────────────── Escalas ─────────────────────────

/**
 * O-SCORE (Gofton 2012; Tavares 2022): juicio RETROSPECTIVO de supervisión, por procedimiento.
 * Anclas traducidas del original ("I had to do", "talk them through", "prompt them from time to time",
 * "be there just in case", "I did not need to be there"). POR REVISAR contra el Anexo 10 del Programa.
 */
export const SUPERVISION = [
  { v: 1, short: 'Tuve que hacerlo yo', text: 'Tuve que hacerlo yo' },
  { v: 2, short: 'Lo guié paso a paso', text: 'Tuve que guiarlo paso a paso' },
  { v: 3, short: 'Le indiqué de vez en cuando', text: 'Tuve que indicarle de vez en cuando' },
  { v: 4, short: 'Solo por si acaso', text: 'Necesité estar presente solo por si acaso' },
  { v: 5, short: 'No necesité estar', text: 'No necesité estar presente' },
] as const

/**
 * Escala de confiabilidad (entrustment; ten Cate 2018, Dubois 2021): juicio PROSPECTIVO, por caso.
 * Niveles sin traslape. POR CONFIRMAR con enseñanza.
 */
export const ENTRUSTMENT = [
  { v: 1, short: 'Solo observar', text: 'Aún no debe realizarlo: solo observar, aunque haya supervisión' },
  { v: 2, short: 'Supervisión directa', text: 'Realizarlo con supervisión directa: el adscrito en la sala' },
  { v: 3, short: 'Supervisión indirecta', text: 'Realizarlo con supervisión indirecta: el adscrito disponible de inmediato' },
  { v: 4, short: 'Sin supervisión', text: 'Realizarlo sin supervisión (revisión posterior)' },
  { v: 5, short: 'Puede supervisar', text: 'Supervisar a un residente menor en un caso similar' },
] as const

export const SCALE5_LABELS = ['Deficiente', 'Insuficiente', 'Aceptable', 'Bueno', 'Sobresaliente']
export const SCALE4_LABELS = ['Pobre', 'Marginal', 'Aceptable', 'Bueno']

export interface Item {
  id: string
  label: string
}

/** Mini-CEX perioperatorio — por caso */
export const MINICEX_ITEMS: Item[] = [
  { id: 'm1', label: 'Valoración preanestésica focalizada' },
  { id: 'm2', label: 'Identificación de riesgos y prioridades' },
  { id: 'm3', label: 'Juicio clínico / toma de decisiones' },
  { id: 'm4', label: 'Ajuste del plan según comorbilidades y evolución' },
  { id: 'm5', label: 'Uso de evidencia, guías o principios correctos' },
  { id: 'm6', label: 'Profesionalismo y ética' },
  { id: 'm7', label: 'Comunicación clínica' },
  { id: 'm8', label: 'Capacidad de síntesis del caso' },
]

export type AntsDomain = 'tarea' | 'equipo' | 'situacional' | 'decisiones'

export const ANTS_DOMAINS: { id: AntsDomain; label: string }[] = [
  { id: 'tarea', label: 'Gestión de tarea' },
  { id: 'equipo', label: 'Trabajo en equipo' },
  { id: 'situacional', label: 'Conciencia situacional' },
  { id: 'decisiones', label: 'Toma de decisiones' },
]

/** ANTS — por caso. Pendiente: enseñanza va a ampliar esta lista. */
export const ANTS_ITEMS: (Item & { domain: AntsDomain })[] = [
  { id: 'a1', domain: 'tarea', label: 'Planifica y prepara adecuadamente' },
  { id: 'a2', domain: 'tarea', label: 'Prioriza correctamente durante el caso' },
  { id: 'a3', domain: 'equipo', label: 'Intercambia información de forma clara y oportuna' },
  { id: 'a4', domain: 'equipo', label: 'Usa autoridad/asertividad de forma adecuada y respetuosa' },
  { id: 'a5', domain: 'situacional', label: 'Recolecta e interpreta información relevante' },
  { id: 'a6', domain: 'situacional', label: 'Anticipa problemas y cambios del caso' },
  { id: 'a7', domain: 'decisiones', label: 'Considera opciones y riesgos antes de actuar' },
  { id: 'a8', domain: 'decisiones', label: 'Reevalúa tras una intervención y ajusta el plan' },
]

// Frases rápidas para que la retroalimentación tome segundos
export const BEST_SUGGESTIONS = [
  'Preoxigenación y posición óptimas',
  'Plan anestésico claro y bien fundamentado',
  'Buena comunicación con cirugía y enfermería',
  'Técnica aséptica impecable',
  'Reaccionó rápido ante la hipotensión',
  'Checklist completo antes de iniciar',
  'Buen control de la analgesia postoperatoria',
]

export const IMPROVE_SUGGESTIONS = [
  'Anticipar la vía aérea difícil con plan B/C',
  'Verbalizar el plan al equipo antes de actuar',
  'Optimizar tiempos de preparación',
  'Revisar referencias anatómicas antes de puncionar',
  'Ajustar dosis a comorbilidades',
  'Reevaluar después de cada intervención',
  'Priorizar mejor ante cambios del caso',
]

// ───────────────────────── Lo esperado por grado ─────────────────────────

export const GRADE_EXPECTATIONS: Record<Grade, string[]> = {
  R1: ['Supervisión directa', 'Bases teóricas', 'Ejecución inicial', 'Comunicación básica y segura'],
  R2: ['Integración clínica', 'Autonomía progresiva', 'Mejor ajuste a comorbilidades', 'Participación académica más activa'],
  R3: ['Autonomía supervisada', 'Manejo de casos complejos', 'Liderazgo', 'Enseñanza a R menores', 'Participación académica / investigación'],
}

// Umbrales de referencia por grado: viven en src/config/umbrales.json. PROVISIONALES (fuente futura:
// Delphi). Solo orientan una lectura formativa ("revisar en la sesión trimestral"), no califican.
// ANTS es solo formativo: no tiene umbral.

type ByGrade = Record<Grade, number>

/** O-SCORE de referencia por procedimiento */
export const OSCORE_TARGET = UMBRALES.oscore as ByGrade
/** Técnicas de mayor riesgo (arterias, catéteres, intubación difícil) */
export const OSCORE_TARGET_HIGH_RISK = UMBRALES.oscoreAltoRiesgo as ByGrade

export const oscoreTarget = (grade: Grade, type?: ProcedureType) =>
  type && procDef(type).altoRiesgo ? OSCORE_TARGET_HIGH_RISK[grade] : OSCORE_TARGET[grade]

/** Entrustment de referencia: R1 llega a supervisión indirecta (3); R2 y R3, sin supervisión (4) */
export const ENTRUSTMENT_TARGET = UMBRALES.entrustment as ByGrade

/** Días tras los cuales un registro sin validar genera recordatorio */
export const REMINDER_DAYS = UMBRALES.diasRecordatorioSinValidar
