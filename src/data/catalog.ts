import type {
  AnesthesiaType,
  AttemptTime,
  Complexity,
  CriticalEvent,
  FollowUp,
  Grade,
  HelpLevel,
  PatientRisk,
  ProcedureType,
  Shift,
} from '../types'

// ───────────────────────── Contexto del caso ─────────────────────────

export const ROOMS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Toco', 'Endosc.']

export const SHIFTS: { id: Shift; label: string }[] = [
  { id: 'ordinaria', label: 'Ordinaria' },
  { id: 'guardia', label: 'Guardia' },
  { id: 'postguardia', label: 'Postguardia' },
]

export const SPECIALTIES: { id: string; label: string; surgeries: string[] }[] = [
  { id: 'cg', label: 'Cirugía general', surgeries: ['Colecistectomía laparoscópica', 'Apendicectomía', 'Hernioplastia inguinal', 'LAPE', 'Funduplicatura'] },
  { id: 'go', label: 'Ginecobstetricia', surgeries: ['Cesárea', 'Histerectomía abdominal', 'Salpingoclasia', 'LUI', 'Histeroscopia'] },
  { id: 'orto', label: 'Ortopedia', surgeries: ['Artroplastia de rodilla', 'Artroplastia de cadera', 'RAFI de radio', 'Artroscopia de rodilla', 'RAFI de tobillo'] },
  { id: 'uro', label: 'Urología', surgeries: ['RTU de próstata', 'Nefrolitotomía percutánea', 'Ureteroscopia', 'Nefrectomía'] },
  { id: 'neuro', label: 'Neurocirugía', surgeries: ['Craneotomía', 'Laminectomía', 'Derivación ventrículo-peritoneal'] },
  { id: 'cct', label: 'Cardiotorácica', surgeries: ['Revascularización coronaria', 'Cambio valvular', 'Lobectomía'] },
  { id: 'ped', label: 'Cirugía pediátrica', surgeries: ['Circuncisión', 'Orquidopexia', 'Plastia umbilical', 'Amigdalectomía'] },
  { id: 'orl', label: 'Otorrino', surgeries: ['Amigdalectomía', 'Septoplastia', 'Cirugía endoscópica de senos'] },
  { id: 'oft', label: 'Oftalmología', surgeries: ['Facoemulsificación', 'Vitrectomía'] },
  { id: 'plas', label: 'Plástica', surgeries: ['Injerto de piel', 'Reconstrucción mamaria', 'Aseo quirúrgico'] },
  { id: 'vasc', label: 'Vascular', surgeries: ['Fístula AV', 'Amputación supracondílea', 'Safenectomía'] },
  { id: 'fuera', label: 'Fuera de quirófano', surgeries: ['Endoscopia alta', 'Colonoscopia', 'Resonancia magnética'] },
]

export const specialtyLabel = (id: string) => SPECIALTIES.find((s) => s.id === id)?.label ?? id

export const ANESTHESIA: { id: AnesthesiaType; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'regional', label: 'Regional' },
  { id: 'sedacion', label: 'Sedación' },
  { id: 'combinada', label: 'Combinada' },
]

export const COMPLEXITY: { id: Complexity; label: string }[] = [
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
]

export const COMORBIDITIES = ['Vía aérea difícil prevista', 'Obesidad', 'Cardiopatía', 'Neumopatía', 'Embarazo', 'Sepsis', 'Otra']

export const CRITICAL: { id: CriticalEvent; label: string }[] = [
  { id: 'no', label: 'No' },
  { id: 'leve', label: 'Sí, leve' },
  { id: 'moderado', label: 'Sí, moderado' },
  { id: 'mayor', label: 'Sí, mayor' },
]

// ───────────────────────── Procedimientos ─────────────────────────

export interface ProcedureDef {
  id: ProcedureType
  label: string
  short: string
  /** Tasa de falla aceptable (p0) e inaceptable (p1) para CUSUM */
  p0: number
  p1: number
  /** Más intentos que esto cuenta como falla para la curva */
  maxAttempts: number
}

export const PROCEDURES: ProcedureDef[] = [
  { id: 'iot', label: 'Intubación orotraqueal', short: 'Intubación', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'mascarilla', label: 'Ventilación con mascarilla', short: 'Mascarilla', p0: 0.05, p1: 0.15, maxAttempts: 2 },
  { id: 'videolaringo', label: 'Videolaringoscopia', short: 'Videolaringo', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'fibroscopio', label: 'Fibroscopio', short: 'Fibroscopio', p0: 0.2, p1: 0.4, maxAttempts: 2 },
  { id: 'neuroaxial', label: 'Bloqueo neuroaxial (subaracnoideo)', short: 'Neuroaxial', p0: 0.1, p1: 0.2, maxAttempts: 2 },
  { id: 'epidural', label: 'Epidural', short: 'Epidural', p0: 0.1, p1: 0.25, maxAttempts: 2 },
  { id: 'arterial', label: 'Acceso arterial', short: 'Línea arterial', p0: 0.15, p1: 0.3, maxAttempts: 2 },
  { id: 'cvc', label: 'Catéter venoso central', short: 'CVC', p0: 0.1, p1: 0.25, maxAttempts: 2 },
  { id: 'periferico', label: 'Bloqueo periférico', short: 'Bloqueo periférico', p0: 0.15, p1: 0.3, maxAttempts: 2 },
  { id: 'otro', label: 'Otro', short: 'Otro', p0: 0.15, p1: 0.3, maxAttempts: 2 },
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
  { id: 4, label: 'Relevo completo', resident: 'Lo terminó el adscrito' },
]

export const INCIDENTS = [
  'Desaturación < 90%',
  'Intubación esofágica',
  'Trauma dental / vía aérea',
  'Broncoaspiración',
  'Punción dural',
  'Punción vascular inadvertida',
  'Parestesia',
  'Hematoma',
  'Neumotórax',
  'Hipotensión significativa',
  'Bloqueo incompleto',
  'Otro',
]

// ───────────────────────── Escalas ─────────────────────────

export const SUPERVISION = [
  { v: 1, short: 'Lo hice yo', text: 'Tuve que hacer yo la mayor parte del caso' },
  { v: 2, short: 'Paso a paso', text: 'Tuve que dirigirlo paso a paso / intervenir frecuentemente' },
  { v: 3, short: 'Indicaciones ocasionales', text: 'Pudo realizarlo con indicaciones ocasionales y supervisión directa' },
  { v: 4, short: 'Solo "por si acaso"', text: 'Pudo realizarlo con supervisión de respaldo; solo estuve disponible "por si acaso"' },
  { v: 5, short: 'Independiente', text: 'Pudo realizarlo de forma independiente y segura para un caso similar' },
] as const

export const ENTRUSTMENT = [
  { v: 1, short: 'Supervisión estrecha', text: 'Aún no realizarlo sin supervisión directa estrecha' },
  { v: 2, short: 'Directa proactiva', text: 'Realizarlo con supervisión directa proactiva' },
  { v: 3, short: 'Indirecta reactiva', text: 'Realizarlo con supervisión indirecta reactiva' },
  { v: 4, short: 'Sin supervisión inmediata', text: 'Realizarlo sin supervisión inmediata' },
  { v: 5, short: 'Puede supervisar', text: 'Supervisar a un residente menor en un caso similar' },
] as const

export const SCALE5_LABELS = ['Deficiente', 'Insuficiente', 'Aceptable', 'Bueno', 'Sobresaliente']
export const SCALE4_LABELS = ['Pobre', 'Marginal', 'Aceptable', 'Bueno']

export interface Item {
  id: string
  label: string
  short?: boolean // incluido en la versión ultracorta
}

/** D. Desempeño global (O-SCORE) — versión completa */
export const GLOBAL_ITEMS: Item[] = [
  { id: 'g1', label: 'Plan anestésico preoperatorio' },
  { id: 'g2', label: 'Preparación del caso y del equipo' },
  { id: 'g3', label: 'Conocimiento teórico aplicado al caso' },
  { id: 'g4', label: 'Ejecución técnica global' },
  { id: 'g5', label: 'Fluidez y eficiencia intraoperatoria' },
  { id: 'g6', label: 'Plan postoperatorio / analgesia / destino' },
  { id: 'g7', label: 'Comunicación con equipo y paciente' },
  { id: 'g8', label: 'Seguridad global del paciente' },
]

/** E. Mini-CEX / juicio clínico — 3 ítems en la versión corta */
export const MINICEX_ITEMS: Item[] = [
  { id: 'm1', label: 'Valoración preanestésica focalizada' },
  { id: 'm2', label: 'Identificación de riesgos y prioridades', short: true },
  { id: 'm3', label: 'Juicio clínico / toma de decisiones', short: true },
  { id: 'm4', label: 'Ajuste del plan según comorbilidades y evolución', short: true },
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

/** F. ANTS abreviado — 4 ítems (uno por dominio) en la versión corta */
export const ANTS_ITEMS: (Item & { domain: AntsDomain })[] = [
  { id: 'a1', domain: 'tarea', label: 'Planifica y prepara adecuadamente', short: true },
  { id: 'a2', domain: 'tarea', label: 'Prioriza correctamente durante el caso' },
  { id: 'a3', domain: 'equipo', label: 'Intercambia información de forma clara y oportuna', short: true },
  { id: 'a4', domain: 'equipo', label: 'Usa autoridad/asertividad de forma adecuada y respetuosa' },
  { id: 'a5', domain: 'situacional', label: 'Recolecta e interpreta información relevante' },
  { id: 'a6', domain: 'situacional', label: 'Anticipa problemas y cambios del caso', short: true },
  { id: 'a7', domain: 'decisiones', label: 'Considera opciones y riesgos antes de actuar', short: true },
  { id: 'a8', domain: 'decisiones', label: 'Reevalúa tras una intervención y ajusta el plan' },
]

/** I. Profesionalismo y competencias transversales — versión completa */
export const PROF_ITEMS: Item[] = [
  { id: 'p1', label: 'Puntualidad y presentación' },
  { id: 'p2', label: 'Responsabilidad y seguimiento del paciente' },
  { id: 'p3', label: 'Respeto al paciente' },
  { id: 'p4', label: 'Empatía' },
  { id: 'p5', label: 'Ética y confidencialidad' },
  { id: 'p6', label: 'Relación con adscritos, enfermería, cirugía y resto del equipo' },
  { id: 'p7', label: 'Receptividad a la retroalimentación' },
]

// ───────────────────────── Cierre ─────────────────────────

export const FOLLOWUP: { id: FollowUp; label: string }[] = [
  { id: 'no', label: 'No' },
  { id: 'observacion', label: 'Sí, observación reforzada' },
  { id: 'repetir', label: 'Sí, repetir procedimiento con supervisión directa' },
  { id: 'sesion', label: 'Sí, sesión de retroalimentación formal' },
]

export const RISK: { id: PatientRisk; label: string }[] = [
  { id: 'no', label: 'No' },
  { id: 'potencial', label: 'Sí, potencial' },
  { id: 'real', label: 'Sí, real' },
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

/**
 * Banda esperada de supervisión (O-SCORE 1–5) según grado y meses dentro del grado.
 * El formulario es el mismo para todos; lo que cambia es el umbral de interpretación.
 */
export function expectedBand(grade: Grade, monthsIntoGrade: number): [number, number] {
  const base = grade === 'R1' ? 1.6 : grade === 'R2' ? 2.6 : 3.4
  const lo = base + Math.min(Math.max(monthsIntoGrade, 0), 12) / 12
  return [lo, Math.min(lo + 1, 5)]
}

/** Umbral ANTS esperado (1–4) por grado */
export const ANTS_TARGET: Record<Grade, number> = { R1: 2.5, R2: 3, R3: 3.5 }

export const SHIFT_LABEL = Object.fromEntries(SHIFTS.map((s) => [s.id, s.label])) as Record<Shift, string>
export const ANESTHESIA_LABEL = Object.fromEntries(ANESTHESIA.map((s) => [s.id, s.label])) as Record<AnesthesiaType, string>
export const FOLLOWUP_LABEL = Object.fromEntries(FOLLOWUP.map((s) => [s.id, s.label])) as Record<FollowUp, string>
export const RISK_LABEL = Object.fromEntries(RISK.map((s) => [s.id, s.label])) as Record<PatientRisk, string>
