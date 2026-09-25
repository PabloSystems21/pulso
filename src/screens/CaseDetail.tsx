import { Link, useParams } from 'react-router-dom'
import { Clock, ShieldAlert } from 'lucide-react'
import { useStore } from '../store'
import {
  ANESTHESIA_LABEL,
  ANTS_ITEMS,
  AREA_LABEL,
  ENTRUSTMENT,
  MINICEX_ITEMS,
  SHIFT_LABEL,
  SUPERVISION,
  type Item,
} from '../data/catalog'
import { userById } from '../data/users'
import { fmtDateLong, fmtDuration } from '../lib/dates'
import { procLabel } from '../lib/stats'
import { Avatar, TopBar } from '../components/ui'
import { ProcLine, caseTitle } from '../components/case'

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
  const { user, cases, saveCase } = useStore()
  const c = cases.find((x) => x.id === id)
  if (!c) return <TopBar title="Caso no encontrado" back fallback="/" />
  const me = user!
  const resident = userById(c.residentId)
  const isAtt = me.role === 'adscrito'
  const e = c.evaluation
  const evaluator = e ? userById(e.attendingId) : c.attendingId ? userById(c.attendingId) : null
  const canEvaluate = isAtt && c.status === 'pendiente' && (c.attendingId === me.id || (!c.attendingId && me.profesor))
  const canReview = !!me.profesor && !!e?.needsProfessorReview && !c.professorReview

  const resolve = (include: boolean) =>
    saveCase({ ...c, professorReview: { professorId: me.id, reviewedAt: new Date().toISOString(), include } })

  return (
    <>
      <TopBar title={caseTitle(c)} sub={fmtDateLong(c.date)} back fallback={isAtt ? '/a' : '/r'} />
      <div className="screen">
        <div className="card">
          <div className="row">
            <Avatar name={isAtt ? resident.name : evaluator?.name ?? resident.name} att={!isAtt} />
            <div className="grow">
              <div className="bold">{isAtt ? resident.short : evaluator?.short ?? 'Sin adscrito'}</div>
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
            <span className="badge">{AREA_LABEL[c.area]}</span>
            <span className="badge">
              ASA {c.asa}
              {c.urgency === 'urgente' ? 'E' : ''}
            </span>
            <span className="badge">{ANESTHESIA_LABEL[c.anesthesia]}</span>
            <span className="badge">
              {c.startTime} · {SHIFT_LABEL[c.shift]}
            </span>
            {c.comorbidities.map((m) => (
              <span key={m} className="badge brand">
                {m}
              </span>
            ))}
            {!c.usualForGrade && <span className="badge warn">No habitual para su grado</span>}
          </div>
          {c.criticalEvent && (
            <div className="card flat mt12" style={{ background: 'var(--warn-soft)', border: 0 }}>
              <div className="tiny bold" style={{ color: 'var(--warn-ink)' }}>
                EVENTO CRÍTICO
              </div>
              <div className="small">{c.criticalEventNote}</div>
            </div>
          )}
          {!c.attendingId && (
            <div className="card flat mt12 row" style={{ background: 'var(--crit-soft)', border: 0 }}>
              <ShieldAlert size={18} color="var(--crit)" />
              <div className="small bold" style={{ color: '#a32424' }}>
                Caso sin adscrito · {c.supervisionGap === 'residente-mayor' ? 'con residente de mayor jerarquía' : 'estuvo solo'}
              </div>
            </div>
          )}
        </div>

        {/* ───── Lo que reportó el residente ───── */}
        <div className="h2">
          Autoevaluación del residente
          <span className="badge brand">Registro</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="tiny muted bold">FORTALEZA, DIFICULTAD U OPORTUNIDAD</div>
          <div className="small">"{c.residentReflection}"</div>
          {c.residentNote && (
            <>
              <div className="tiny muted bold mt12">NOTA PARA EL ADSCRITO</div>
              <div className="small">"{c.residentNote}"</div>
            </>
          )}
          {c.procedures.length > 0 && (
            <div className="stack mt16" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              {c.procedures.map((p) => (
                <div key={p.id}>
                  <ProcLine p={p} score={e?.supervision[p.id]} />
                  {p.notes && <div className="small ink2 mt8">{p.notes}</div>}
                  <Link
                    to={rid ? `/a/residente/${rid}/procedimiento/${p.type}` : isAtt ? `/a/residente/${c.residentId}/procedimiento/${p.type}` : `/r/procedimiento/${p.type}`}
                    className="small bold"
                    style={{ display: 'block', color: 'var(--accent-ink)', marginTop: 6 }}
                  >
                    Ver curva CUSUM →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ───── Lo que puso quien evaluó ───── */}
        {!e ? (
          <>
            <div className="h2">
              Evaluación
              <span className="badge warn">Pendiente</span>
            </div>
            <div className="card center">
              {canEvaluate ? (
                <>
                  <div className="bold">Este caso espera tu evaluación</div>
                  <Link to={`/a/evaluar/${c.id}`} className="btn primary block mt12">
                    Evaluar ahora
                  </Link>
                </>
              ) : (
                <div className="small ink2">
                  {c.attendingId ? (
                    <>
                      Esperando evaluación de <b>{evaluator?.short}</b>
                    </>
                  ) : (
                    <>Esperando revisión de un profesor</>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="h2">
              Evaluación del adscrito
              <span className="tiny muted">{e.durationSec ? `${fmtDuration(e.durationSec)} min` : ''}</span>
            </div>
            <div className="hero-card">
              <div className="muted tiny bold">O-SCORE POR PROCEDIMIENTO</div>
              <div className="stack mt8">
                {c.procedures.map((p) => (
                  <div key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.14)', paddingBottom: 8 }}>
                    <div className="tiny muted">{procLabel(p)}</div>
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{e.supervision[p.id]}</div>
                      <div className="small" style={{ marginTop: 4 }}>
                        {SUPERVISION[e.supervision[p.id] - 1].text}
                      </div>
                    </div>
                  </div>
                ))}
                {!c.procedures.length && <div className="small muted">Caso sin procedimientos registrados.</div>}
              </div>
              <div className="muted tiny bold mt16">ENTRUSTMENT DEL CASO</div>
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
              {e.comments && (
                <div className="feedback-quote mt16" style={{ borderLeftColor: 'var(--series-1)' }}>
                  <div className="tiny muted bold">COMENTARIOS</div>
                  <div style={{ fontSize: 15 }}>{e.comments}</div>
                </div>
              )}
            </div>

            <ScoreList title="Habilidades no técnicas (ANTS)" items={ANTS_ITEMS} values={e.ants} max={4} />
            <ScoreList title="Mini-CEX" items={MINICEX_ITEMS} values={e.miniCex} max={5} />

            <div className="h2">Cierre</div>
            <div className="list">
              <div className="list-row">
                <span className="grow small">Amerita revisión de un profesor</span>
                <b className="small">{e.needsProfessorReview ? 'Sí' : 'No'}</b>
              </div>
              <div className="list-row">
                <span className="grow small">Riesgo atribuible al residente</span>
                <b className="small">{e.patientRisk ? 'Sí' : 'No'}</b>
              </div>
            </div>
            {e.patientRisk && e.patientRiskNote && (
              <div className="card flat mt8" style={{ background: 'var(--crit-soft)', border: 0 }}>
                <div className="tiny bold" style={{ color: '#a32424' }}>
                  RIESGO REPORTADO
                </div>
                <div className="small">{e.patientRiskNote}</div>
              </div>
            )}

            {c.professorReview && (
              <div className="card mt12">
                <div className="tiny muted bold">REVISIÓN DEL PROFESOR</div>
                <div className="small">
                  {userById(c.professorReview.professorId).short} · {c.professorReview.include ? 'Se incluye en el progreso' : 'Se excluye del progreso'}
                </div>
              </div>
            )}
            {canReview && (
              <div className="card mt12">
                <div className="bold small">Este caso amerita tu revisión</div>
                <div className="tiny muted mt8">Decide si cuenta para el progreso del residente.</div>
                <div className="row mt12">
                  <button className="btn block" onClick={() => resolve(false)}>
                    Excluir
                  </button>
                  <button className="btn primary block" onClick={() => resolve(true)}>
                    Incluir
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
