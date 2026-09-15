// Modelo de datos de Pulso. Todo vive en memoria + localStorage (sin backend por ahora).

export type Role = 'adscrito' | 'residente'
export type Grade = 'R1' | 'R2' | 'R3'

export interface User {
  id: string
  name: string
  short: string // cómo se muestra en listas: "Dr. Felipe González"
  role: Role
  grade?: Grade
  gradeStart?: string // ISO, inicio del grado actual
  teachingTeam?: boolean // profesor del equipo de enseñanza
  title?: string
}

export type Shift = 'ordinaria' | 'guardia' | 'postguardia'
export type Urgency = 'electivo' | 'urgente'
export type Complexity = 'baja' | 'media' | 'alta'
export type AnesthesiaType = 'general' | 'regional' | 'sedacion' | 'combinada'
export type CriticalEvent = 'no' | 'leve' | 'moderado' | 'mayor'
export type EvalType = 'global' | 'procedimiento' | 'ambos'

export type ProcedureType =
  | 'iot'
  | 'mascarilla'
  | 'videolaringo'
  | 'fibroscopio'
  | 'neuroaxial'
  | 'epidural'
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
  otherLabel?: string
  firstOperator: boolean
  success: boolean
  attempts: 1 | 2 | 3 | 4 // 4 = "4 o más"
  time: AttemptTime
  help: HelpLevel
  safety: boolean
  incidents: string[]
  notes?: string
}

/** Escala 1–5, null = no observado */
export type Score5 = 1 | 2 | 3 | 4 | 5 | null
/** Escala ANTS 1–4, null = no observado */
export type Score4 = 1 | 2 | 3 | 4 | null

export type FollowUp = 'no' | 'observacion' | 'repetir' | 'sesion'
export type PatientRisk = 'no' | 'potencial' | 'real'

export interface Evaluation {
  version: 'corta' | 'completa'
  attendingId: string
  evaluatedAt: string // ISO datetime
  durationSec?: number
  supervision: 1 | 2 | 3 | 4 | 5 // O-SCORE: lo que ocurrió
  entrustment: 1 | 2 | 3 | 4 | 5 // prospectiva: para un caso similar
  ants: Record<string, Score4> // clave = id de ítem ANTS
  miniCex: Record<string, Score5> // juicio clínico / Mini-CEX
  global?: Record<string, Score5> // 8 ítems O-SCORE (versión completa)
  professionalism?: Record<string, Score5> // versión completa
  best: string
  improve: string
  plan?: string
  countsForProgression: boolean
  followUp: FollowUp
  patientRisk: PatientRisk
  proceduresConfirmed: boolean
}

export interface CaseRecord {
  id: string
  residentId: string
  attendingId: string
  createdBy: Role
  createdAt: string
  // A. Identificación
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  room: string
  shift: Shift
  grade: Grade
  // B. Contexto clínico
  specialty: string
  surgery: string
  urgency: Urgency
  asa: 1 | 2 | 3 | 4 | 5
  complexity: Complexity
  anesthesia: AnesthesiaType
  comorbidities: string[]
  usualForGrade: boolean
  criticalEvent: CriticalEvent
  // G. Procedimientos
  procedures: ProcedureRecord[]
  residentNote?: string
  // Estado
  status: 'pendiente' | 'evaluado'
  evaluation?: Evaluation
}
