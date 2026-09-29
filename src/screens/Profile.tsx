import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, KeyRound, LogOut, RotateCcw, Users } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Sheet, TopBar } from '../components/ui'
import { ENTRUSTMENT_TARGET, GRADE_EXPECTATIONS, OSCORE_TARGET, OSCORE_TARGET_HIGH_RISK, PROCEDURES, PROTOCOL_PROCEDURES, criteriaText, hasCurve } from '../data/catalog'
import { cusumParams } from '../lib/cusum'

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
            <div className="tiny muted num mt8">Código de empleado {user.id}</div>
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
              <div className="tiny muted">Pendientes y calificaciones del servicio</div>
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
              <div className="tiny muted center mt12">¿La olvidaste? La restablece el administrador del programa.</div>
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
            <div className="bold">O-SCORE · por procedimiento · juicio retrospectivo</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Escala 1–5 de cuánto tuvo que intervenir el adscrito: de "tuve que hacerlo yo" a "no necesité estar presente" (Gofton 2012; Tavares 2022). Solo la asigna el adscrito;
              la autoevaluación del residente se guarda por separado.
            </p>
          </div>
          <div className="card">
            <div className="bold">Confiabilidad (entrustment) · por caso · juicio prospectivo</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Qué se le confiaría en un caso similar: de "solo observar" a "puede supervisar a otros". Apta para decisiones formativas (Dubois 2021).
            </p>
          </div>
          <div className="card">
            <div className="bold">ANTS y Mini-CEX · por caso</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              ANTS: adaptación de 8 elementos de los 4 dominios de Fletcher 2003, escala 1–4 + no observado, de uso solo formativo (sin umbral ni alertas). Mini-CEX: adaptación
              perioperatoria de Norcini 2003, escala de 5 puntos.
            </p>
          </div>
          <div className="card">
            <div className="bold">Éxito de un procedimiento</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Se calcula con criterios por procedimiento, igual para todos los grados. Lo que reporta el residente es provisional; el resultado definitivo se fija cuando el adscrito
              valida (y puede corregirlo con motivo). O-SCORE 1 siempre es fallo. Sin adscrito, participación parcial o "no lo presencié" no cuentan.
            </p>
            <ul className="tiny ink2" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              {PROTOCOL_PROCEDURES.map((p) => (
                <li key={p.id}>
                  <b>{p.short}:</b> {criteriaText(p).slice(0, -1).join(', ')}
                  {p.criteriosProvisionales ? ' (provisional)' : ''}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="bold">Curva CUSUM · {PROCEDURES.filter(hasCurve).length} procedimientos con parámetros publicados</div>
            <p className="small ink2" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
              Método estándar (Aguirre Ospina 2014; Chang y McLean 2006): cada éxito resta s y cada fallo suma 1 − s. Cruzar H0 hacia abajo = alcanzó el estándar. Estar arriba de
              H1 pasado el periodo de gracia = alerta formativa. Antes de los casos mínimos, "insuficiente para concluir".
            </p>
            <table className="data mt12">
              <thead>
                <tr>
                  <th>Procedimiento</th>
                  <th className="r">p0</th>
                  <th className="r">p1</th>
                  <th className="r">s</th>
                  <th className="r">±h</th>
                  <th className="r">Mín.</th>
                </tr>
              </thead>
              <tbody>
                {PROCEDURES.filter(hasCurve).map((p) => {
                  const k = cusumParams(p as Parameters<typeof cusumParams>[0])
                  return (
                    <tr key={p.id}>
                      <td>{p.short}</td>
                      <td className="r num">{p.p0}</td>
                      <td className="r num">{p.p1}</td>
                      <td className="r num">{k.s.toFixed(3)}</td>
                      <td className="r num">{k.h1.toFixed(2)}</td>
                      <td className="r num">{k.minCases}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="tiny muted mt8">
              α = β = 0.10. Fuente: Aguirre Ospina et al. 2014, tabla 3. En calibración (solo tasa de éxito, parámetros por estimar en el ciclo 2):{' '}
              {PROTOCOL_PROCEDURES.filter((p) => !hasCurve(p)).map((p) => p.short).join(', ')}. Son {PROTOCOL_PROCEDURES.length} procedimientos del protocolo; "Otro" no tiene curva.
            </div>
          </div>
          <div className="card">
            <div className="bold">Referencias por grado · provisionales</div>
            <table className="data mt8">
              <thead>
                <tr>
                  <th></th>
                  <th className="r">R1</th>
                  <th className="r">R2</th>
                  <th className="r">R3</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>O-SCORE</td>
                  {(['R1', 'R2', 'R3'] as const).map((g) => (
                    <td key={g} className="r num">
                      ≥ {OSCORE_TARGET[g]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>O-SCORE mayor riesgo</td>
                  {(['R1', 'R2', 'R3'] as const).map((g) => (
                    <td key={g} className="r num">
                      {g === 'R1' ? '2–3' : `≥ ${OSCORE_TARGET_HIGH_RISK[g]}`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Confiabilidad</td>
                  {(['R1', 'R2', 'R3'] as const).map((g) => (
                    <td key={g} className="r num">
                      ≥ {ENTRUSTMENT_TARGET[g]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <div className="tiny muted mt8">
              Mayor riesgo: {PROCEDURES.filter((p) => p.altoRiesgo).map((p) => p.short).join(', ')}. Sin fuente documental todavía (fuente futura: Delphi); se configuran en
              src/config/umbrales.json. Son para la lectura formativa en la sesión trimestral, no una calificación. ANTS no tiene umbral.
            </div>
          </div>
          {user.profesor && (
            <Link to="/a/verificacion" className="card card-link row">
              <span className="avatar att">
                <FlaskConical size={18} />
              </span>
              <div className="grow">
                <div className="bold small">Verificación de la curva CUSUM</div>
                <div className="tiny muted">Secuencia de prueba de 20 intentos contra los valores esperados</div>
              </div>
            </Link>
          )}
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
        <p className="tiny muted center mt16">Pulso · prototipo v0.5 · datos simulados, sin información de pacientes reales</p>
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
