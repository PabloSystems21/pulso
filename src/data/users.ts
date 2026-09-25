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

/**
 * El id ES el código de empleado (adscritos) o la matrícula (residentes):
 * con ese código inician sesión. Ningún código se repite y no hay cambios de rol:
 * si alguien cambia de puesto se crea un usuario nuevo y el anterior se conserva.
 */
export const USERS: User[] = [
  { id: '10482', name: 'Felipe González', short: 'Dr. Felipe González', role: 'adscrito', profesor: true, title: 'Profesor titular · Anestesiología' },
  { id: '10517', name: 'Ana Sofía Treviño', short: 'Dra. Ana Sofía Treviño', role: 'adscrito', profesor: true, title: 'Profesora adjunta · Vía aérea' },
  { id: '10603', name: 'Mariana Ortiz', short: 'Dra. Mariana Ortiz', role: 'adscrito', profesor: true, title: 'Profesora · Anestesia obstétrica' },
  { id: '10744', name: 'Luis Herrera', short: 'Dr. Luis Herrera', role: 'adscrito', profesor: true, title: 'Profesor · Anestesia regional' },
  { id: '10896', name: 'Raúl Vega', short: 'Dr. Raúl Vega', role: 'adscrito', title: 'Adscrito · Anestesia cardiovascular' },
  { id: '10921', name: 'Paula Ibarra', short: 'Dra. Paula Ibarra', role: 'adscrito', title: 'Adscrita · Anestesia pediátrica' },

  { id: '26104', name: 'Pablo Rodríguez', short: 'Pablo Rodríguez', role: 'residente', grade: 'R1', gradeStart: gs },
  { id: '26118', name: 'Daniela Cruz', short: 'Daniela Cruz', role: 'residente', grade: 'R1', gradeStart: gs },
  { id: '25073', name: 'Jorge Salinas', short: 'Jorge Salinas', role: 'residente', grade: 'R2', gradeStart: gs },
  { id: '25089', name: 'Valeria Mendoza', short: 'Valeria Mendoza', role: 'residente', grade: 'R2', gradeStart: gs },
  { id: '24035', name: 'Andrés Fuentes', short: 'Andrés Fuentes', role: 'residente', grade: 'R3', gradeStart: gs },
  { id: '24042', name: 'Regina Lara', short: 'Regina Lara', role: 'residente', grade: 'R3', gradeStart: gs },
]

export const userById = (id: string) => USERS.find((u) => u.id === id)!
export const findUser = (id: string) => USERS.find((u) => u.id === id)
export const ATTENDINGS = USERS.filter((u) => u.role === 'adscrito')
export const PROFESORES = USERS.filter((u) => u.profesor)
export const RESIDENTS = USERS.filter((u) => u.role === 'residente')

/** Contraseña genérica de primer acceso: la reparte el administrador junto con el código. */
export const initialPassword = (u: User) => `Anes.${u.id}`

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
