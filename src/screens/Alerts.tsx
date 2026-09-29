import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Users } from 'lucide-react'
import { useStore } from '../store'
import { programAlerts, type Alert } from '../lib/stats'
import { userById } from '../data/users'
import { AlertCard, Empty, TopBar } from '../components/ui'

const SECTIONS: { kind: Alert['kind']; title: string; hint: string }[] = [
  { kind: 'sin-adscrito', title: 'Casos sin adscrito', hint: 'Por normativa representan riesgo para el paciente. No se evalúan ni suman a la CUSUM' },
  { kind: 'evento-critico', title: 'Eventos críticos', hint: 'Reportados por el residente al registrar el caso' },
  { kind: 'riesgo', title: 'Riesgo para el paciente', hint: 'Reportado por el adscrito que evaluó' },
  { kind: 'revision', title: 'Ameritan revisión', hint: 'Quedan fuera de las gráficas hasta que un profesor decida si se incluyen' },
  { kind: 'rechazo', title: 'Registros rechazados', hint: 'El adscrito indicó que el registro no corresponde; no cuenta para nada' },
  { kind: 'cusum', title: 'Alertas formativas de curva (CUSUM)', hint: 'Arriba del límite superior pasado el periodo de gracia: proponer acompañamiento. En R1 es más esperable' },
  { kind: 'desempeno', title: 'Para la sesión trimestral', hint: 'O-SCORE de los últimos 10 casos debajo de la referencia provisional del grado (solo O-SCORE; ANTS no cuenta)' },
  { kind: 'sin-validar', title: 'Registros sin validar', hint: 'Llevan más del plazo configurado esperando al adscrito' },
]

export default function Alerts() {
  const { cases } = useStore()
  const nav = useNavigate()
  const alerts = useMemo(() => programAlerts(cases), [cases])

  return (
    <>
      <TopBar title="Alertas del programa" sub={`${alerts.length} por atender`} />
      <div className="screen">
        <Link to="/a/equipo" className="card card-link row">
          <span className="avatar att">
            <Users size={18} />
          </span>
          <div className="grow">
            <div className="bold">Equipo de adscritos</div>
            <div className="small muted">Quién tiene pendientes y qué calificaciones pone cada quien</div>
          </div>
          <ChevronRight size={18} className="muted" />
        </Link>

        {!alerts.length && (
          <div className="mt16">
            <Empty icon={<ShieldCheck size={32} />} title="Todo en orden" text="No hay alertas activas en el programa." />
          </div>
        )}

        {SECTIONS.map((s) => {
          const list = alerts.filter((a) => a.kind === s.kind)
          if (!list.length) return null
          return (
            <div key={s.kind}>
              <div className="h2">
                {s.title} <span className="badge">{list.length}</span>
              </div>
              <div className="tiny muted" style={{ margin: '-6px 2px 8px' }}>
                {s.hint}
              </div>
              <div className="stack">
                {list.map((a, i) => (
                  <AlertCard key={i} alert={a} who={a.residentId ? userById(a.residentId).short : undefined} onClick={a.to ? () => nav(a.to!) : undefined} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
