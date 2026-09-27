import type { AnesthesiaType, Area, Asa, AttemptTime, Grade, HelpLevel, ProcedureType, Shift } from '../types'

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

export interface ProcedureDef {
  id: ProcedureType
  label: string
  short: string
  /** Tasa de falla aceptable (p0) e inaceptable (p1) para CUSUM — POR CONFIRMAR con enseñanza */
  p0: number
  p1: number
  /** Más intentos que esto cuenta como falla para la curva */
  maxAttempts: number
  /** Pide "¿cuál?" en texto libre */
  needsLabel?: boolean
  /** Técnica de mayor riesgo: al R1 se le pide un umbral de O-SCORE menor (2–3) */
  highRisk?: boolean
}

export const PROCEDURES: ProcedureDef[] = [
  { id: 'laringoscopia', label: 'Laringoscopia directa', short: 'Laringoscopia', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'mascarilla', label: 'Ventilación con mascarilla', short: 'Mascarilla', p0: 0.05, p1: 0.15, maxAttempts: 2 },
  { id: 'videolaringo', label: 'Videolaringoscopia', short: 'Videolaringo', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'fibroscopio', label: 'Fibroscopio', short: 'Fibroscopio', p0: 0.2, p1: 0.4, maxAttempts: 2, highRisk: true },
  { id: 'espinal', label: 'Bloqueo espinal', short: 'Espinal', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'epidural', label: 'Epidural', short: 'Epidural', p0: 0.1, p1: 0.25, maxAttempts: 2 },
  { id: 'mixto', label: 'Bloqueo mixto', short: 'Mixto', p0: 0.1, p1: 0.25, maxAttempts: 2 },
  { id: 'arterial', label: 'Acceso arterial', short: 'Línea arterial', p0: 0.15, p1: 0.3, maxAttempts: 2, highRisk: true },
  { id: 'cvc', label: 'Catéter venoso central', short: 'CVC', p0: 0.1, p1: 0.25, maxAttempts: 2, highRisk: true },
  { id: 'periferico', label: 'Bloqueo periférico', short: 'Bloqueo periférico', p0: 0.15, p1: 0.3, maxAttempts: 2, needsLabel: true },
  { id: 'otro', label: 'Otro', short: 'Otro', p0: 0.15, p1: 0.3, maxAttempts: 2, needsLabel: true },
]

export const procDef = (id: ProcedureType) => PROCEDURES.find((p) => p.id === id)!

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
  'Desaturación < 90%',
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

/** O-SCORE: es por procedimiento */
export const SUPERVISION = [
  { v: 1, short: 'Lo hice yo', text: 'Tuve que hacer yo la mayor parte del procedimiento' },
  { v: 2, short: 'Paso a paso', text: 'Tuve que dirigirlo paso a paso / intervenir frecuentemente' },
  { v: 3, short: 'Indicaciones ocasionales', text: 'Pudo realizarlo con indicaciones ocasionales y supervisión directa' },
  { v: 4, short: 'Solo "por si acaso"', text: 'Pudo realizarlo con supervisión de respaldo; solo estuve disponible "por si acaso"' },
  { v: 5, short: 'Independiente', text: 'Pudo realizarlo de forma independiente y segura' },
] as const

/** Entrustment: es por caso */
export const ENTRUSTMENT = [
  { v: 1, short: 'Supervisión estrecha', text: 'Aún no atender un caso así sin supervisión directa estrecha' },
  { v: 2, short: 'Directa proactiva', text: 'Atenderlo con supervisión directa proactiva' },
  { v: 3, short: 'Indirecta reactiva', text: 'Atenderlo con supervisión indirecta reactiva' },
  { v: 4, short: 'Sin supervisión inmediata', text: 'Atenderlo sin supervisión inmediata' },
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

// Umbrales dictados por enseñanza. "Más de 3" se interpreta como ≥ 3 (las escalas son enteras).

/** O-SCORE mínimo esperado por procedimiento: R1 ≥ 3 · R2 y R3 ≥ 4 */
export const OSCORE_TARGET: Record<Grade, number> = { R1: 3, R2: 4, R3: 4 }
/** Técnicas de mayor riesgo (arterias, catéteres, intubación difícil): R1 entre 2 y 3 · R2 y R3 ≥ 4 */
export const OSCORE_TARGET_HIGH_RISK: Record<Grade, number> = { R1: 2, R2: 4, R3: 4 }

export const oscoreTarget = (grade: Grade, type?: ProcedureType) =>
  type && procDef(type).highRisk ? OSCORE_TARGET_HIGH_RISK[grade] : OSCORE_TARGET[grade]

/** ANTS: lo ideal es ≥ 3 en todos los dominios, en todos los grados */
export const ANTS_TARGET: Record<Grade, number> = { R1: 3, R2: 3, R3: 3 }

/**
 * Entrustment esperado: el R1 llega a supervisión indirecta (3); R2 y R3, sin supervisión (4).
 * POR CONFIRMAR: interpretación de la nota de enseñanza.
 */
export const ENTRUSTMENT_TARGET: Record<Grade, number> = { R1: 3, R2: 4, R3: 4 }
