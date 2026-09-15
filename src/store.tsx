import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CaseRecord, User } from './types'
import { getSeed } from './data/seed'
import { userById } from './data/users'
import { byDate } from './lib/stats'

// Sin backend: el historial se genera en memoria y solo lo que el usuario crea/cambia
// se guarda en localStorage. "Reiniciar demo" lo borra.
const DATA_KEY = 'pulso:data:v1'
const USER_KEY = 'pulso:user:v1'

interface Persisted {
  created: CaseRecord[]
  overrides: Record<string, CaseRecord>
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* almacenamiento no disponible */
  }
  return { created: [], overrides: {} }
}

interface Store {
  user: User | null
  cases: CaseRecord[]
  login: (id: string) => void
  logout: () => void
  /** Cambia de usuario y aterriza en una ruta (atajos del demo) */
  switchTo: (id: string, path: string) => void
  redirectTo: string | null
  clearRedirect: () => void
  saveCase: (c: CaseRecord) => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load)
  const [userId, setUserId] = useState<string | null>(() => {
    // Link directo al demo: https://tu-sitio/?as=fgonzalez  (o ?as=prodriguez)
    const as = new URLSearchParams(window.location.search).get('as')
    if (as && userById(as)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      return as
    }
    try {
      return localStorage.getItem(USER_KEY)
    } catch {
      return null
    }
  })

  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }, [data])

  useEffect(() => {
    try {
      if (userId) localStorage.setItem(USER_KEY, userId)
      else localStorage.removeItem(USER_KEY)
    } catch {
      /* ignore */
    }
  }, [userId])

  const cases = useMemo(() => {
    const seed = getSeed().map((c) => data.overrides[c.id] ?? c)
    return [...seed, ...data.created].sort(byDate)
  }, [data])

  const saveCase = useCallback((c: CaseRecord) => {
    setData((d) => {
      if (getSeed().some((s) => s.id === c.id)) return { ...d, overrides: { ...d.overrides, [c.id]: c } }
      const exists = d.created.some((x) => x.id === c.id)
      return { ...d, created: exists ? d.created.map((x) => (x.id === c.id ? c : x)) : [...d.created, c] }
    })
  }, [])

  const value = useMemo<Store>(
    () => ({
      user: userId ? userById(userId) ?? null : null,
      cases,
      login: setUserId,
      logout: () => setUserId(null),
      switchTo: (id, path) => {
        setUserId(id)
        setRedirectTo(path)
      },
      redirectTo,
      clearRedirect: () => setRedirectTo(null),
      saveCase,
      reset: () => setData({ created: [], overrides: {} }),
    }),
    [userId, cases, saveCase, redirectTo],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider faltante')
  return s
}

export const newId = (prefix = 'c') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
