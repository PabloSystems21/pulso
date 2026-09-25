import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CaseRecord, User } from './types'
import { getSeed } from './data/seed'
import { findUser, initialPassword, userById } from './data/users'
import { byDate } from './lib/stats'

// Sin backend: el historial se genera en memoria y solo lo que el usuario crea/cambia
// se guarda en localStorage. "Reiniciar demo" lo borra.
const DATA_KEY = 'pulso:data:v2'
const USER_KEY = 'pulso:user:v2'

/** Cuenta de acceso: usuario = código de empleado / matrícula */
interface Account {
  password: string
  changed: boolean
}

interface Persisted {
  created: CaseRecord[]
  overrides: Record<string, CaseRecord>
  accounts: Record<string, Account>
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Persisted
      return { created: p.created ?? [], overrides: p.overrides ?? {}, accounts: p.accounts ?? {} }
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return { created: [], overrides: {}, accounts: {} }
}

interface Store {
  user: User | null
  cases: CaseRecord[]
  /** Inicio de sesión con código y contraseña */
  login: (code: string, password: string) => string | null
  /** Atajo del demo: entra sin escribir la contraseña */
  quickLogin: (id: string) => void
  logout: () => void
  /** Cambia de usuario y aterriza en una ruta (atajos del demo) */
  switchTo: (id: string, path: string) => void
  redirectTo: string | null
  clearRedirect: () => void
  saveCase: (c: CaseRecord) => void
  reset: () => void
  /** Estado de la cuenta (si ya cambió su contraseña genérica) */
  accountOf: (id: string) => Account
  changePassword: (id: string, password: string) => void
  /** Un profesor restablece la contraseña genérica de alguien */
  resetPassword: (id: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(() => {
    // Link directo al demo: https://tu-sitio/?as=10482
    const as = new URLSearchParams(window.location.search).get('as')
    if (as && findUser(as)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      return as
    }
    try {
      return localStorage.getItem(USER_KEY)
    } catch {
      return null
    }
  })

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

  const accountOf = useCallback(
    (id: string): Account => data.accounts[id] ?? { password: initialPassword(userById(id)), changed: false },
    [data.accounts],
  )

  const setAccount = useCallback((id: string, a: Account) => {
    setData((d) => ({ ...d, accounts: { ...d.accounts, [id]: a } }))
  }, [])

  const value = useMemo<Store>(
    () => ({
      user: userId ? findUser(userId) ?? null : null,
      cases,
      login: (code, password) => {
        const u = findUser(code.trim())
        if (!u) return 'Ese código no existe. Pídelo al profesor o al administrador.'
        if (accountOf(u.id).password !== password) return 'Contraseña incorrecta.'
        setUserId(u.id)
        return null
      },
      quickLogin: setUserId,
      logout: () => setUserId(null),
      switchTo: (id, path) => {
        setUserId(id)
        setRedirectTo(path)
      },
      redirectTo,
      clearRedirect: () => setRedirectTo(null),
      saveCase,
      reset: () => setData({ created: [], overrides: {}, accounts: {} }),
      accountOf,
      changePassword: (id, password) => setAccount(id, { password, changed: true }),
      resetPassword: (id) => setAccount(id, { password: initialPassword(userById(id)), changed: false }),
    }),
    [userId, cases, saveCase, redirectTo, accountOf, setAccount],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider faltante')
  return s
}

export const newId = (prefix = 'c') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
