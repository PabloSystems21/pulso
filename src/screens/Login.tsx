import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Stethoscope, GraduationCap } from 'lucide-react'
import { useStore } from '../store'
import { USERS, userById } from '../data/users'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'

export default function Login() {
  const { login } = useStore()
  const nav = useNavigate()
  const [more, setMore] = useState(false)
  const enter = (id: string) => {
    login(id)
    nav(userById(id).role === 'residente' ? '/r' : '/a', { replace: true })
  }
  const felipe = userById('fgonzalez')
  const pablo = userById('prodriguez')

  return (
    <div className="app">
      <div className="screen no-tabs" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        <div className="row" style={{ gap: 12 }}>
          <Logo size={48} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Pulso</div>
            <div className="small muted">Evaluación de residentes · Anestesiología</div>
          </div>
        </div>

        <div className="h-hero" style={{ marginTop: 36 }}>
          Cada caso cuenta.
          <br />
          <span style={{ color: 'var(--accent-ink)' }}>Cada intento, también.</span>
        </div>
        <p className="ink2" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 10 }}>
          Registro por caso en menos de 1 minuto, evaluación del adscrito en 2 minutos, y curvas de aprendizaje automáticas (O-SCORE, ANTS y CUSUM).
        </p>

        <div className="row mt24" style={{ marginBottom: 10 }}>
          <span className="demo-pill">Modo demo</span>
          <span className="small muted">Sin contraseña · datos simulados</span>
        </div>

        <div className="stack">
          <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => enter(felipe.id)}>
            <Avatar name={felipe.name} att lg />
            <div className="grow">
              <div className="row small muted bold" style={{ gap: 6 }}>
                <Stethoscope size={14} /> Adscrito
              </div>
              <div className="bold" style={{ fontSize: 17 }}>
                {felipe.short}
              </div>
              <div className="small muted">{felipe.title}</div>
            </div>
            <ChevronRight className="muted" />
          </button>
          <button className="card card-link row" style={{ border: 0, textAlign: 'left', width: '100%' }} onClick={() => enter(pablo.id)}>
            <Avatar name={pablo.name} lg />
            <div className="grow">
              <div className="row small muted bold" style={{ gap: 6 }}>
                <GraduationCap size={14} /> Residente
              </div>
              <div className="bold" style={{ fontSize: 17 }}>
                {pablo.short}
              </div>
              <div className="small muted">{pablo.grade} · Anestesiología</div>
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
              <button key={u.id} className="list-row" onClick={() => enter(u.id)}>
                <Avatar name={u.name} att={u.role === 'adscrito'} />
                <div className="grow">
                  <div className="bold">{u.short}</div>
                  <div className="small muted">{u.role === 'adscrito' ? u.title : `Residente ${u.grade}`}</div>
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
