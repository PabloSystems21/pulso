const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (d: Date, n: number) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export const todayISO = () => toISODate(new Date())

/** Días completos de a → b (b − a) */
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)

export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const monthShort = (m: number) => MONTHS[m]
export const monthLong = (m: number) => MONTHS_LONG[m]

export const fmtDate = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const fmtDateLong = (s: string) => {
  const d = parseDate(s)
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const fmtRelative = (s: string) => {
  const n = daysBetween(s, todayISO())
  if (n <= 0) return 'Hoy'
  if (n === 1) return 'Ayer'
  if (n < 7) return `Hace ${n} días`
  return fmtDate(s)
}

export const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30

export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))}`
