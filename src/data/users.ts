import type { Grade, User } from '../types'

/** Fecha de promoción: cada 1 de marzo todos los residentes suben de grado. */
export const PROMOTION = { month: 2, day: 1 }

/** Inicio del ciclo académico vigente en una fecha. */
export function academicYearStart(now = new Date()): Date {
  const y = now >= new Date(now.getFullYear(), PROMOTION.month, PROMOTION.day) ? now.getFullYear() : now.getFullYear() - 1
  return new Date(y, PROMOTION.month, PROMOTION.day)
}

/** Grado según el año de ingreso: 0 años → R1, 1 → R2, 2 → R3, 3+ → egresado (null). */
export function gradeForIngreso(ingreso: number, at = new Date()): Grade | null {
  const years = academicYearStart(at).getFullYear() - ingreso
  if (years < 0 || years > 2) return null
  return (['R1', 'R2', 'R3'] as const)[years]
}

/** Fecha de ingreso a la residencia (para generar su historial). */
export const residencyStart = (u: User) => new Date(u.ingreso!, PROMOTION.month, PROMOTION.day)

// En producción `ingreso` es un año fijo (lo trae el Excel). En el demo se calcula relativo al
// ciclo actual para que siempre haya R1, R2 y R3.
const cy = academicYearStart().getFullYear()

/** Completa grado / egresado a partir del ingreso: esto es lo que hace la promoción automática. */
function withGrade(u: User): User {
  if (u.role !== 'residente' || u.ingreso === undefined) return u
  const grade = gradeForIngreso(u.ingreso)
  return { ...u, grade: grade ?? undefined, egresado: !grade, gradeStart: academicYearStart().toISOString() }
}

/**
 * El id ES el código de empleado (adscritos y residentes; algunos residentes podrían entrar
 * con matrícula): con ese código inician sesión. Ningún código se repite y no hay cambios de rol:
 * si alguien cambia de puesto se crea un usuario nuevo y el anterior se conserva.
 */
export const USERS: User[] = (
  [
    { id: '10482', name: 'Carlos Felipe González', short: 'Dr. Carlos Felipe González', role: 'adscrito', profesor: true, title: 'Profesor titular · Anestesiología' },
    { id: '10517', name: 'Ana Sofía Treviño', short: 'Dra. Ana Sofía Treviño', role: 'adscrito', profesor: true, title: 'Profesora adjunta · Vía aérea' },
    { id: '10603', name: 'Mariana Ortiz', short: 'Dra. Mariana Ortiz', role: 'adscrito', title: 'Adscrita · Anestesia obstétrica' },
    { id: '10744', name: 'Luis Herrera', short: 'Dr. Luis Herrera', role: 'adscrito', title: 'Adscrito · Anestesia regional' },
    { id: '10896', name: 'Raúl Vega', short: 'Dr. Raúl Vega', role: 'adscrito', title: 'Adscrito · Anestesia cardiovascular' },
    { id: '10921', name: 'Paula Ibarra', short: 'Dra. Paula Ibarra', role: 'adscrito', title: 'Adscrita · Anestesia pediátrica' },

    { id: '26104', name: 'Pablo Rodríguez', short: 'Pablo Rodríguez', role: 'residente', ingreso: cy },
    { id: '26118', name: 'Daniela Cruz', short: 'Daniela Cruz', role: 'residente', ingreso: cy },
    { id: '25073', name: 'Jorge Salinas', short: 'Jorge Salinas', role: 'residente', ingreso: cy - 1 },
    { id: '25089', name: 'Valeria Mendoza', short: 'Valeria Mendoza', role: 'residente', ingreso: cy - 1 },
    { id: '24035', name: 'Andrés Fuentes', short: 'Andrés Fuentes', role: 'residente', ingreso: cy - 2 },
    { id: '24042', name: 'Regina Lara', short: 'Regina Lara', role: 'residente', ingreso: cy - 2 },
  ] as User[]
).map(withGrade)

export const userById = (id: string) => USERS.find((u) => u.id === id)!
export const findUser = (id: string) => USERS.find((u) => u.id === id)
export const ATTENDINGS = USERS.filter((u) => u.role === 'adscrito')
export const PROFESORES = USERS.filter((u) => u.profesor)
/** Residentes activos (los egresados se conservan con su historial, pero no aparecen en listas) */
export const RESIDENTS = USERS.filter((u) => u.role === 'residente' && !u.egresado)

/** Contraseña genérica de primer acceso: la reparte el administrador junto con el código. */
export const initialPassword = (u: User) => `Anes.${u.id}`

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
