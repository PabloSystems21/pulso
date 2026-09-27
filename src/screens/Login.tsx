import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, GraduationCap, Stethoscope } from 'lucide-react'
import { DEMO_NO_PASSWORD, useStore } from '../store'
import { USERS, findUser, initialPassword } from '../data/users'
import { DISCLAIMER } from '../data/legal'
import type { Role, User } from '../types'
import { Avatar, Modal } from '../components/ui'
import { Logo } from '../components/Logo'

const DISCLAIMER_KEY = 'pulso:aviso-visto'

/** Usuario con el que se prellena cada modo del demo */
const DEMO_DEFAULT: Record<Role, string> = { adscrito: '10482', residente: '26104' }

const roleLabel = (u: User) => (u.role === 'adscrito' ? (u.profesor ? 'Adscrito · Profesor' : 'Adscrito') : `Residente ${u.grade}`)

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  // Demo: primero se escoge el modo y luego aparece el login real, ya lleno
  const [mode, setMode] = useState<Role | null>(null)
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  // El aviso es lo primero que sale al abrir la app (una vez por sesión del navegador), para todos
  const [disclaimer, setDisclaimer] = useState(() => {
    try {
      return sessionStorage.getItem(DISCLAIMER_KEY) !== '1'
    } catch {
      return true
    }
  })
  const acceptDisclaimer = () => {
    try {
      sessionStorage.setItem(DISCLAIMER_KEY, '1')
    } catch {
      /* almacenamiento no disponible: se vuelve a mostrar la próxima vez */
    }
    setDisclaimer(false)
  }

  const fill = (id: string) => {
    const u = findUser(id)!
    setCode(u.id)
    setPass(initialPassword(u))
    setError(null)
    setPicker(false)
  }
  const choose = (r: Role) => {
    setMode(r)
    fill(DEMO_DEFAULT[r])
  }

  const selected = findUser(code.trim())
  const typed = code.trim().toLowerCase()
  const options = USERS.filter((u) => u.role === mode && !u.egresado)
  // Sugerencias mientras escribe: por código o por nombre
  const suggestions = typed && !selected ? USERS.filter((u) => !u.egresado && (u.id.includes(typed) || u.name.toLowerCase().includes(typed))).slice(0, 5) : []

  const enter = (u: User) => nav(u.role === 'residente' ? '/r' : '/a', { replace: true })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = login(code, pass)
    if (err) return setError(err)
    enter(findUser(code.trim())!)
  }

  return (
    <div className="app">
      <div className="screen no-tabs" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }}>
        <div className="row" style={{ gap: 12 }}>
          <Logo size={48} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Pulso</div>
            <div className="small muted">Evaluación de residentes · Anestesiología</div>
          </div>
        </div>

        {!mode ? (
          <>
            <div className="row mt24" style={{ marginBottom: 10 }}>
              <span className="demo-pill">Demo</span>
              <span className="small muted">Escoge cómo quieres ver la app</span>
            </div>
            <div className="stack">
              <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => choose('adscrito')}>
                <span className="avatar att lg">
                  <Stethoscope size={22} />
                </span>
                <div className="grow">
                  <div className="bold" style={{ fontSize: 17 }}>
                    Demo · modo adscrito
                  </div>
                  <div className="small muted">Evalúa casos y, como profesor, atiende las alertas</div>
                </div>
                <ChevronRight className="muted" />
              </button>
              <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => choose('residente')}>
                <span className="avatar lg">
                  <GraduationCap size={22} />
                </span>
                <div className="grow">
                  <div className="bold" style={{ fontSize: 17 }}>
                    Demo · modo residente
                  </div>
                  <div className="small muted">Registra un caso y mira tu progreso</div>
                </div>
                <ChevronRight className="muted" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="btn ghost sm mt16" style={{ paddingLeft: 0 }} onClick={() => setMode(null)}>
              <ChevronLeft size={16} /> Cambiar modo
            </button>
            <form onSubmit={submit} className="card mt8">
              <div className="field-label" style={{ marginTop: 0 }}>
                Código de empleado o matrícula
              </div>
              <input
                className="input"
                autoComplete="username"
                placeholder="Ej. 10482"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setError(null)
                }}
              />
              {selected ? (
                <div className="row mt8" style={{ gap: 8 }}>
                  <Avatar name={selected.name} att={selected.role === 'adscrito'} />
                  <div className="grow">
                    <div className="small bold">{selected.short}</div>
                    <div className="tiny muted">{roleLabel(selected)}</div>
                  </div>
                </div>
              ) : (
                suggestions.length > 0 && (
                  <div className="list mt8">
                    {suggestions.map((u) => (
                      <button key={u.id} type="button" className="list-row" onClick={() => fill(u.id)}>
                        <Avatar name={u.name} att={u.role === 'adscrito'} />
                        <div className="grow">
                          <div className="small bold">{u.short}</div>
                          <div className="tiny muted num">
                            {u.id} · {roleLabel(u)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
              <button type="button" className="btn ghost sm mt8" style={{ paddingLeft: 0 }} onClick={() => setPicker(!picker)}>
                Escoger otro usuario <ChevronDown size={16} style={{ transform: picker ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
              </button>
              {picker && (
                <div className="list">
                  {options.map((u) => (
                    <button key={u.id} type="button" className="list-row" onClick={() => fill(u.id)}>
                      <Avatar name={u.name} att={u.role === 'adscrito'} />
                      <div className="grow">
                        <div className="small bold">{u.short}</div>
                        <div className="tiny muted num">
                          {u.id} · {roleLabel(u)}
                        </div>
                      </div>
                      {selected?.id === u.id && <Check size={18} color="var(--brand)" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="field-label">Contraseña</div>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder={DEMO_NO_PASSWORD ? 'No se necesita en el demo' : 'La que te dieron'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              {DEMO_NO_PASSWORD && <div className="tiny muted mt8">Por ahora no necesitas poner contraseña: ya viene llena, solo dale a Continuar.</div>}
              {error && (
                <div className="small mt12" style={{ color: 'var(--crit)' }}>
                  {error}
                </div>
              )}
              <button className="btn primary block mt16" type="submit" disabled={!code.trim() || (!DEMO_NO_PASSWORD && !pass)}>
                Continuar
              </button>
              <div className="tiny muted center mt12">¿Olvidaste tu contraseña? La restablece el administrador del programa.</div>
            </form>
          </>
        )}
      </div>

      <Modal open={disclaimer}>
        <div className="bold" style={{ fontSize: 18 }}>
          {DISCLAIMER.title}
        </div>
        {DISCLAIMER.paragraphs.map((p) => (
          <p key={p} className="small ink2" style={{ lineHeight: 1.55 }}>
            {p}
          </p>
        ))}
        <button className="btn primary block mt16" onClick={acceptDisclaimer}>
          {DISCLAIMER.accept}
        </button>
      </Modal>
    </div>
  )
}
