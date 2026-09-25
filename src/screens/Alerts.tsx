import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Users } from 'lucide-react'
import { useStore } from '../store'
import { programAlerts, type Alert } from '../lib/stats'
import { userById } from '../data/users'
import { AlertCard, Empty, TopBar } from '../components/ui'

const SECTIONS: { kind: Alert['kind']; title: string; hint: string }[] = [
  { kind: 'sin-adscrito', title: 'Casos sin adscrito', hint: 'Por normativa requieren revisión: cualquier profesor puede evaluarlos' },
  { kind: 'riesgo', title: 'Riesgo para el paciente', hint: 'Reportado por el adscrito que evaluó' },
  { kind: 'revision', title: 'Ameritan revisión', hint: 'El adscrito pidió que un profesor valide el caso' },
  { kind: 'cusum', title: 'Caídas de desempeño (CUSUM)', hint: 'La curva cruzó el límite inaceptable' },
  { kind: 'desempeno', title: 'Por debajo de lo esperado', hint: 'Promedio de los últimos 10 casos contra la banda del grado' },
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
            <div className="small muted">Quién tiene pendientes y quién no ha cambiado su contraseña</div>
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
