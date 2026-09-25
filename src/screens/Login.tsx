import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, GraduationCap, Stethoscope } from 'lucide-react'
import { useStore } from '../store'
import { USERS, initialPassword, userById } from '../data/users'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'

export default function Login() {
  const { login, quickLogin, accountOf } = useStore()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)

  const go = (id: string) => {
    quickLogin(id)
    nav(userById(id).role === 'residente' ? '/r' : '/a', { replace: true })
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = login(code, pass)
    if (err) return setError(err)
    const u = userById(code.trim())
    nav(u.role === 'residente' ? '/r' : '/a', { replace: true })
  }
  const felipe = userById('10482')
  const pablo = userById('26104')

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

        <form onSubmit={submit} className="card mt24">
          <div className="field-label" style={{ marginTop: 0 }}>
            Código de empleado o matrícula
          </div>
          <input className="input" inputMode="numeric" autoComplete="username" placeholder="Ej. 10482" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="field-label">Contraseña</div>
          <input className="input" type="password" autoComplete="current-password" placeholder="La que te dieron" value={pass} onChange={(e) => setPass(e.target.value)} />
          {error && (
            <div className="small mt12" style={{ color: 'var(--crit)' }}>
              {error}
            </div>
          )}
          <button className="btn primary block mt16" type="submit" disabled={!code.trim() || !pass}>
            Entrar
          </button>
          <div className="tiny muted center mt12">¿Olvidaste tu contraseña? La restablece un profesor del programa.</div>
        </form>

        <div className="row mt24" style={{ marginBottom: 10 }}>
          <span className="demo-pill">Modo demo</span>
          <span className="small muted">Entra sin escribir la contraseña</span>
        </div>

        <div className="stack">
          <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => go(felipe.id)}>
            <Avatar name={felipe.name} att lg />
            <div className="grow">
              <div className="row small muted bold" style={{ gap: 6 }}>
                <Stethoscope size={14} /> Adscrito · Profesor
              </div>
              <div className="bold" style={{ fontSize: 17 }}>
                {felipe.short}
              </div>
              <div className="small muted num">Código {felipe.id}</div>
            </div>
            <ChevronRight className="muted" />
          </button>
          <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => go(pablo.id)}>
            <Avatar name={pablo.name} lg />
            <div className="grow">
              <div className="row small muted bold" style={{ gap: 6 }}>
                <GraduationCap size={14} /> Residente
              </div>
              <div className="bold" style={{ fontSize: 17 }}>
                {pablo.short}
              </div>
              <div className="small muted num">Matrícula {pablo.id}</div>
            </div>
            <ChevronRight className="muted" />
          </button>
        </div>

        <button className="btn ghost block mt12" onClick={() => setMore(!more)}>
          Otros usuarios demo <ChevronDown size={18} style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
        </button>
        {more && (
          <div className="list">
            {USERS.filter((u) => u.id !== felipe.id && u.id !== pablo.id).map((u) => (
              <button key={u.id} className="list-row" onClick={() => go(u.id)}>
                <Avatar name={u.name} att={u.role === 'adscrito'} />
                <div className="grow">
                  <div className="bold">{u.short}</div>
                  <div className="tiny muted num">
                    {u.id} · {u.role === 'adscrito' ? (u.profesor ? 'Profesor' : 'Adscrito') : `Residente ${u.grade}`}
                    {!accountOf(u.id).changed && ` · ${initialPassword(u)}`}
                  </div>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
