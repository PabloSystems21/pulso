import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, RotateCcw, Users } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Sheet, TopBar } from '../components/ui'
import { GRADE_EXPECTATIONS, PROCEDURES } from '../data/catalog'
import { ALPHA, BETA, CUSUM_RULE, cusumParams } from '../lib/cusum'

export default function Profile() {
  const { user, logout, reset, accountOf, changePassword } = useStore()
  const nav = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [done, setDone] = useState(false)
  if (!user) return null
  const account = accountOf(user.id)
  const canSave = pass.length >= 6 && pass === pass2

  return (
    <>
      <TopBar title="Perfil" />
      <div className="screen">
        <div className="card row">
          <Avatar name={user.name} att={user.role === 'adscrito'} lg />
          <div className="grow">
            <div className="bold" style={{ fontSize: 18 }}>
              {user.short}
            </div>
            <div className="small muted">{user.role === 'adscrito' ? user.title : `Residente ${user.grade} · Anestesiología`}</div>
            <div className="tiny muted num mt8">{user.role === 'adscrito' ? `Código ${user.id}` : `Matrícula ${user.id}`}</div>
          </div>
          {user.profesor && <span className="badge brand">Profesor</span>}
        </div>

        {user.profesor && (
          <Link to="/a/equipo" className="card card-link row mt12">
            <span className="avatar att">
              <Users size={18} />
            </span>
            <div className="grow">
              <div className="bold small">Equipo de adscritos</div>
              <div className="tiny muted">Pendientes y contraseñas del servicio</div>
            </div>
          </Link>
        )}

        <div className="h2">
          Contraseña
          {!account.changed && <span className="badge warn">Sin cambiar</span>}
        </div>
        <div className="card">
          {done ? (
            <div className="small" style={{ color: 'var(--good-ink)' }}>
              Listo, tu contraseña quedó actualizada.
            </div>
          ) : (
            <>
              {!account.changed && <div className="small ink2">Sigues usando la contraseña genérica que te dio el programa. Cámbiala por una tuya.</div>}
              <div className="field-label" style={{ marginTop: account.changed ? 0 : 16 }}>
                Nueva contraseña
              </div>
              <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <div className="field-label">Repítela</div>
              <input className="input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
              <button
                className="btn primary block mt16"
                disabled={!canSave}
                onClick={() => {
                  changePassword(user.id, pass)
                  setPass('')
                  setPass2('')
                  setDone(true)
                }}
              >
                <KeyRound size={16} /> Guardar contraseña
              </button>
              <div className="tiny muted center mt12">¿La olvidaste? Un profesor puede restablecerla.</div>
            </>
          )}
        </div>

        {user.grade && (
          <>
            <div className="h2">Lo que se espera de un {user.grade}</div>
            <div className="card">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }} className="ink2">
                {GRADE_EXPECTATIONS[user.grade].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="h2">¿Cómo se calcula?</div>
        <div className="stack">
          <div className="card">
            <div className="bold">O-SCORE · por procedimiento</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Escala 1–5 sobre cuánto apoyo requirió: de "tuve que hacerlo yo" a "lo hizo de forma independiente y segura". Se califica cada procedimiento por separado.
            </p>
          </div>
          <div className="card">
            <div className="bold">Entrustment y ANTS · por caso</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              El entrustment dice si podría atender un caso así después. ANTS evalúa habilidades no técnicas en 4 dominios (escala 1–4 + no observado). El Mini-CEX cubre el juicio clínico.
            </p>
          </div>
          <div className="card">
            <div className="bold">CUSUM · curva por procedimiento</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Cada éxito baja la curva y cada falla la sube. Cruzar la línea verde = desempeño aceptable (competencia); cruzar la roja = tasa de falla inaceptable. {CUSUM_RULE}. α = {ALPHA}, β ={' '}
              {BETA}.
            </p>
            <table className="data mt12">
              <thead>
                <tr>
                  <th>Procedimiento</th>
                  <th className="r">p0</th>
                  <th className="r">p1</th>
                  <th className="r">h</th>
                </tr>
              </thead>
              <tbody>
                {PROCEDURES.filter((p) => p.id !== 'otro').map((p) => (
                  <tr key={p.id}>
                    <td>{p.short}</td>
                    <td className="r num">{Math.round(p.p0 * 100)}%</td>
                    <td className="r num">{Math.round(p.p1 * 100)}%</td>
                    <td className="r num">±{cusumParams(p).h1.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tiny muted mt8">p0 = tasa de falla aceptable · p1 = inaceptable. Valores provisionales: los debe fijar el equipo de enseñanza.</div>
          </div>
        </div>

        <div className="h2">Demo</div>
        <div className="list">
          <button
            className="list-row"
            onClick={() => {
              logout()
              nav('/login')
            }}
          >
            <LogOut size={18} className="muted" /> <span className="grow bold">Cerrar sesión</span>
          </button>
          <button className="list-row" onClick={() => setConfirm(true)}>
            <RotateCcw size={18} className="muted" /> <span className="grow bold">Reiniciar datos del demo</span>
          </button>
        </div>
        <p className="tiny muted center mt16">Pulso · prototipo v0.2 · datos simulados, sin información de pacientes reales</p>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="bold" style={{ fontSize: 18 }}>
          ¿Reiniciar el demo?
        </div>
        <p className="small ink2">Se borran los casos, evaluaciones y contraseñas que capturaste. El historial simulado se conserva.</p>
        <div className="row mt16">
          <button className="btn block" onClick={() => setConfirm(false)}>
            Cancelar
          </button>
          <button
            className="btn primary block"
            onClick={() => {
              reset()
              setConfirm(false)
            }}
          >
            Reiniciar
          </button>
        </div>
      </Sheet>
    </>
  )
}
