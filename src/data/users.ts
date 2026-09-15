import type { Grade, User } from '../types'

/** El ciclo académico de la residencia inicia el 1 de marzo. */
export function academicYearStart(now = new Date()): Date {
  const y = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1
  return new Date(y, 2, 1)
}

const gradeNum = (g: Grade) => Number(g[1])

/** Fecha de ingreso a la residencia (para generar su historial). */
export function residencyStart(grade: Grade, now = new Date()): Date {
  const s = academicYearStart(now)
  return new Date(s.getFullYear() - (gradeNum(grade) - 1), 2, 1)
}

const gs = academicYearStart().toISOString()

export const USERS: User[] = [
  { id: 'fgonzalez', name: 'Felipe González', short: 'Dr. Felipe González', role: 'adscrito', teachingTeam: true, title: 'Profesor titular · Anestesiología' },
  { id: 'mortiz', name: 'Mariana Ortiz', short: 'Dra. Mariana Ortiz', role: 'adscrito', title: 'Adscrita · Anestesia obstétrica' },
  { id: 'lherrera', name: 'Luis Herrera', short: 'Dr. Luis Herrera', role: 'adscrito', title: 'Adscrito · Anestesia regional' },
  { id: 'atrevino', name: 'Ana Sofía Treviño', short: 'Dra. Ana Sofía Treviño', role: 'adscrito', teachingTeam: true, title: 'Profesora adjunta · Vía aérea' },

  { id: 'prodriguez', name: 'Pablo Rodríguez', short: 'Pablo Rodríguez', role: 'residente', grade: 'R1', gradeStart: gs },
  { id: 'dcruz', name: 'Daniela Cruz', short: 'Daniela Cruz', role: 'residente', grade: 'R1', gradeStart: gs },
  { id: 'jsalinas', name: 'Jorge Salinas', short: 'Jorge Salinas', role: 'residente', grade: 'R2', gradeStart: gs },
  { id: 'vmendoza', name: 'Valeria Mendoza', short: 'Valeria Mendoza', role: 'residente', grade: 'R2', gradeStart: gs },
  { id: 'afuentes', name: 'Andrés Fuentes', short: 'Andrés Fuentes', role: 'residente', grade: 'R3', gradeStart: gs },
  { id: 'rlara', name: 'Regina Lara', short: 'Regina Lara', role: 'residente', grade: 'R3', gradeStart: gs },
]

export const userById = (id: string) => USERS.find((u) => u.id === id)!
export const ATTENDINGS = USERS.filter((u) => u.role === 'adscrito')
export const RESIDENTS = USERS.filter((u) => u.role === 'residente')

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
