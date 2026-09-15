import { Link, useParams } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useStore } from '../store'
import {
  ANESTHESIA_LABEL,
  ANTS_ITEMS,
  ENTRUSTMENT,
  FOLLOWUP_LABEL,
  GLOBAL_ITEMS,
  MINICEX_ITEMS,
  PROF_ITEMS,
  RISK_LABEL,
  SHIFT_LABEL,
  SUPERVISION,
  specialtyLabel,
  type Item,
} from '../data/catalog'
import { userById } from '../data/users'
import { fmtDateLong, fmtDuration } from '../lib/dates'
import { Avatar, TopBar } from '../components/ui'
import { ProcLine } from '../components/case'

function Dots({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span className="tiny muted">N/O</span>
  return (
    <span className="row" style={{ gap: 4 }} aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ width: 9, height: 9, borderRadius: 5, background: i < value ? 'var(--series-1)' : '#e3e8ea' }} />
      ))}
      <b className="small num" style={{ width: 14, textAlign: 'right' }}>
        {value}
      </b>
    </span>
  )
}

function ScoreList({ title, items, values, max }: { title: string; items: Item[]; values?: Record<string, number | null>; max: number }) {
  if (!values) return null
  const list = items.filter((i) => i.id in values)
  if (!list.length) return null
  return (
    <>
      <div className="h2">{title}</div>
      <div className="list">
        {list.map((i) => (
          <div key={i.id} className="list-row" style={{ cursor: 'default' }}>
            <span className="grow small">{i.label}</span>
            <Dots value={values[i.id]} max={max} />
          </div>
        ))}
      </div>
    </>
  )
}

export default function CaseDetail() {
  const { id, rid } = useParams()
  const { user, cases } = useStore()
  const c = cases.find((x) => x.id === id)
  if (!c) return <TopBar title="Caso no encontrado" back />
  const resident = userById(c.residentId)
  const att = userById(c.evaluation?.attendingId ?? c.attendingId)
  const e = c.evaluation
  const isAtt = user!.role === 'adscrito'

  return (
    <>
      <TopBar title={c.surgery} sub={fmtDateLong(c.date)} back={rid ? `/a/residente/${rid}` : true} />
      <div className="screen">
        <div className="card">
          <div className="row">
            <Avatar name={isAtt ? resident.name : att.name} att={!isAtt} />
            <div className="grow">
              <div className="bold">{isAtt ? resident.short : att.short}</div>
              <div className="tiny muted">{isAtt ? `Residente ${c.grade}` : e ? 'Evaluó este caso' : 'Adscrito responsable'}</div>
            </div>
            {c.status === 'pendiente' ? (
              <span className="badge warn">
                <Clock size={11} /> Pendiente
              </span>
            ) : (
              <span className="badge good">Evaluado</span>
            )}
          </div>
          <div className="row wrap mt12" style={{ gap: 6 }}>
            <span className="badge">{specialtyLabel(c.specialty)}</span>
            <span className="badge">
              ASA {c.asa}
              {c.urgency === 'urgente' ? 'E' : ''}
            </span>
            <span className="badge">{ANESTHESIA_LABEL[c.anesthesia]}</span>
            <span className="badge">Complejidad {c.complexity}</span>
            <span className="badge">
              {c.room} · {c.startTime} · {SHIFT_LABEL[c.shift]}
            </span>
            {c.comorbidities.map((m) => (
              <span key={m} className="badge brand">
                {m}
              </span>
            ))}
            {c.criticalEvent !== 'no' && <span className="badge crit">Evento crítico {c.criticalEvent}</span>}
          </div>
          {c.residentNote && (
            <div className="feedback-quote mt12">
              <div className="tiny muted bold">NOTA DEL RESIDENTE</div>
              <div className="small">"{c.residentNote}"</div>
            </div>
          )}
        </div>

        {c.procedures.length > 0 && (
          <>
            <div className="h2">Procedimientos</div>
            <div className="stack">
              {c.procedures.map((p) => (
                <div key={p.id} className="card tight">
                  <ProcLine p={p} />
                  {p.notes && <div className="small ink2 mt8">{p.notes}</div>}
                  <Link to={rid ? `/a/residente/${rid}/procedimiento/${p.type}` : isAtt ? `/a/residente/${c.residentId}/procedimiento/${p.type}` : `/r/procedimiento/${p.type}`} className="small bold mt8" style={{ display: 'block', color: 'var(--accent-ink)' }}>
                    Ver curva CUSUM →
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {!e && (
          <div className="card mt16 center">
            {isAtt && c.attendingId === user!.id ? (
              <>
                <div className="bold">Este caso espera tu evaluación</div>
                <Link to={`/a/evaluar/${c.id}`} className="btn primary block mt12">
                  Evaluar ahora (≈ 2 min)
                </Link>
              </>
            ) : (
              <div className="small ink2">
                Esperando evaluación de <b>{att.short}</b>
              </div>
            )}
          </div>
        )}

        {e && (
          <>
            <div className="h2">
              Evaluación
              <span className="tiny muted">
                {e.version === 'completa' ? 'Versión completa' : 'Versión corta'}
                {e.durationSec ? ` · ${fmtDuration(e.durationSec)} min` : ''}
              </span>
            </div>
            <div className="hero-card">
              <div className="muted tiny bold">SUPERVISIÓN QUE REQUIRIÓ (O-SCORE)</div>
              <div className="row mt8" style={{ alignItems: 'flex-start' }}>
                <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{e.supervision}</div>
                <div className="small" style={{ marginTop: 2 }}>
                  {SUPERVISION[e.supervision - 1].text}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,.18)', margin: '14px 0 10px' }} />
              <div className="muted tiny bold">PARA UN CASO SIMILAR ESTÁ LISTO PARA</div>
              <div className="row mt8" style={{ alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{e.entrustment}</div>
                <div className="small">{ENTRUSTMENT[e.entrustment - 1].text}</div>
              </div>
            </div>

            <div className="card mt12">
              <div className="feedback-quote">
                <div className="tiny muted bold">LO MEJOR DE ESTE DESEMPEÑO</div>
                <div style={{ fontSize: 15 }}>{e.best}</div>
              </div>
              <div className="feedback-quote improve mt16">
                <div className="tiny muted bold">PRIORIDAD DE MEJORA</div>
                <div style={{ fontSize: 15 }}>{e.improve}</div>
              </div>
              {e.plan && (
                <div className="feedback-quote mt16" style={{ borderLeftColor: 'var(--series-1)' }}>
                  <div className="tiny muted bold">PLAN PARA EL SIGUIENTE CASO</div>
                  <div style={{ fontSize: 15 }}>{e.plan}</div>
                </div>
              )}
            </div>

            <ScoreList title="Habilidades no técnicas (ANTS)" items={ANTS_ITEMS} values={e.ants} max={4} />
            <ScoreList title={e.version === 'completa' ? 'Mini-CEX' : 'Juicio clínico'} items={MINICEX_ITEMS} values={e.miniCex} max={5} />
            <ScoreList title="Desempeño global" items={GLOBAL_ITEMS} values={e.global} max={5} />
            <ScoreList title="Profesionalismo" items={PROF_ITEMS} values={e.professionalism} max={5} />

            <div className="h2">Cierre</div>
            <div className="list">
              <div className="list-row">
                <span className="grow small">Cuenta para progresión</span>
                <b className="small">{e.countsForProgression ? 'Sí' : 'No'}</b>
              </div>
              <div className="list-row">
                <span className="grow small">Seguimiento</span>
                <b className="small" style={{ textAlign: 'right' }}>
                  {FOLLOWUP_LABEL[e.followUp]}
                </b>
              </div>
              <div className="list-row">
                <span className="grow small">Riesgo atribuible</span>
                <b className="small">{RISK_LABEL[e.patientRisk]}</b>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
