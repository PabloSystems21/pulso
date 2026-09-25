// Modelo de datos de Pulso. Todo vive en memoria + localStorage (sin backend por ahora).

export type Role = 'adscrito' | 'residente'
export type Grade = 'R1' | 'R2' | 'R3'

export interface User {
  /** El id ES el código de empleado / matrícula: con eso inician sesión */
  id: string
  name: string
  short: string
  role: Role
  /** Un profesor siempre es adscrito; un adscrito no siempre es profesor */
  profesor?: boolean
  grade?: Grade
  gradeStart?: string
  title?: string
}

/** Dónde ocurrió: no importa el número de quirófano, sino el área */
export type Area = 'quirofano' | 'toco' | 'fuera'
/** Ordinaria = matutino · Guardia = complementaria (vespertino o guardia) */
export type Shift = 'ordinaria' | 'guardia'
export type Urgency = 'electivo' | 'urgente'
export type AnesthesiaType = 'general' | 'regional' | 'sedacion' | 'combinada'
export type Asa = 1 | 2 | 3 | 4 | 5 | 6

export type ProcedureType =
  | 'laringoscopia'
  | 'mascarilla'
  | 'videolaringo'
  | 'fibroscopio'
  | 'espinal'
  | 'epidural'
  | 'mixto'
  | 'arterial'
  | 'cvc'
  | 'periferico'
  | 'otro'

export type AttemptTime = '<5' | '5-10' | '>10'
/** 0 ninguna · 1 solo verbal · 2 demostración parcial · 3 relevo parcial · 4 relevo completo */
export type HelpLevel = 0 | 1 | 2 | 3 | 4

export interface ProcedureRecord {
  id: string
  type: ProcedureType
  /** "¿Cuál?" para bloqueo periférico y para Otro */
  label?: string
  firstOperator: boolean
  success: boolean
  attempts: 1 | 2 | 3 | 4 // 4 = "4 o más"
  time: AttemptTime
  help: HelpLevel
  incidents: string[]
  incidentOther?: string
  notes?: string
}

/** Escala 1–5, null = no observado */
export type Score5 = 1 | 2 | 3 | 4 | 5 | null
/** Escala ANTS 1–4, null = no observado */
export type Score4 = 1 | 2 | 3 | 4 | null

export interface Evaluation {
  attendingId: string
  evaluatedAt: string
  durationSec?: number
  /** O-SCORE: es POR PROCEDIMIENTO. Llave = id del procedimiento */
  supervision: Record<string, 1 | 2 | 3 | 4 | 5>
  /** Entrustment: es POR CASO */
  entrustment: 1 | 2 | 3 | 4 | 5
  /** ANTS: por caso */
  ants: Record<string, Score4>
  /** Mini-CEX: por caso */
  miniCex: Record<string, Score5>
  best: string
  improve: string
  comments?: string
  /** Sustituye a "cuenta para la progresión": lo valida un profesor */
  needsProfessorReview: boolean
  patientRisk: boolean
  patientRiskNote?: string
}

/** Resolución del profesor cuando un caso amerita revisión */
export interface ProfessorReview {
  professorId: string
  reviewedAt: string
  include: boolean
  note?: string
}

export interface CaseRecord {
  id: string
  residentId: string
  /** null = el caso no tuvo adscrito presente */
  attendingId: string | null
  /** Solo cuando no hubo adscrito */
  supervisionGap?: 'solo' | 'residente-mayor'
  createdAt: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  area: Area
  shift: Shift
  grade: Grade
  urgency: Urgency
  asa: Asa
  anesthesia: AnesthesiaType
  comorbidities: string[]
  usualForGrade: boolean
  criticalEvent: boolean
  criticalEventNote?: string
  procedures: ProcedureRecord[]
  /** Obligatorio: fortaleza, dificultad u oportunidad de mejora */
  residentReflection: string
  /** Opcional: nota para el adscrito */
  residentNote?: string
  status: 'pendiente' | 'evaluado'
  evaluation?: Evaluation
  professorReview?: ProfessorReview
}
