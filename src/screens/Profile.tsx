import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Sheet, TopBar } from '../components/ui'
import { GRADE_EXPECTATIONS, PROCEDURES } from '../data/catalog'
import { ALPHA, BETA, CUSUM_RULE, cusumParams } from '../lib/cusum'

export default function Profile() {
  const { user, logout, reset } = useStore()
  const nav = useNavigate()
  const [confirm, setConfirm] = useState(false)
  if (!user) return null

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
            {user.teachingTeam && <span className="badge brand mt8">Equipo de enseñanza</span>}
          </div>
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
            <div className="bold">O-SCORE · Supervisión</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Escala 1–5 con anclas coloquiales: de "tuve que hacerlo yo" a "pudo hacerlo de forma independiente". Una segunda pregunta prospectiva (entrustment) indica
              para qué está listo en un caso similar.
            </p>
          </div>
          <div className="card">
            <div className="bold">ANTS · Habilidades no técnicas</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              4 dominios (gestión de tarea, trabajo en equipo, conciencia situacional, toma de decisiones), escala 1–4 + no observado. La versión corta usa 1 ítem por dominio.
            </p>
          </div>
          <div className="card">
            <div className="bold">CUSUM · Curva por procedimiento</div>
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
            <div className="tiny muted mt8">p0 = tasa de falla aceptable · p1 = inaceptable. Umbrales configurables por el equipo de enseñanza.</div>
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
            <LogOut size={18} className="muted" /> <span className="grow bold">Cambiar de usuario</span>
          </button>
          <button className="list-row" onClick={() => setConfirm(true)}>
            <RotateCcw size={18} className="muted" /> <span className="grow bold">Reiniciar datos del demo</span>
          </button>
        </div>
        <p className="tiny muted center mt16">Pulso · prototipo v0.1 · datos simulados, sin información de pacientes reales</p>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="bold" style={{ fontSize: 18 }}>
          ¿Reiniciar el demo?
        </div>
        <p className="small ink2">Se borran los casos y evaluaciones que capturaste. El historial simulado se conserva.</p>
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
