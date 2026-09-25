import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { newId, useStore } from '../store'
import type { AnesthesiaType, Area, Asa, CaseRecord, ProcedureRecord, Shift, Urgency } from '../types'
import { ANESTHESIA, AREAS, ASA_OPTIONS, COMORBIDITIES, SHIFTS } from '../data/catalog'
import { ATTENDINGS, userById } from '../data/users'
import { addDays, fmtDateLong, toISODate, todayISO } from '../lib/dates'
import { Avatar, Chips, MultiChips, TopBar, YesNo } from '../components/ui'
import { ProcedureFlow } from '../components/ProcedureFlow'
import { ProcLine } from '../components/case'

interface Form {
  date: string
  startTime: string
  area?: Area
  shift: Shift
  attendingId?: string | null
  supervisionGap?: 'solo' | 'residente-mayor'
  urgency?: Urgency
  asa?: Asa
  anesthesia?: AnesthesiaType
  comorbidities: string[]
  usualForGrade?: boolean
  criticalEvent?: boolean
  criticalEventNote: string
  procedures: ProcedureRecord[]
  residentReflection: string
  residentNote: string
}

function defaultTime() {
  const d = new Date(Date.now() - 2 * 3600_000)
  const h = Math.max(7, d.getHours())
  return `${String(h).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`
}

const STEPS = ['Identificación', 'El caso', 'Procedimientos', 'Enviar'] as const

export default function NewCase() {
  const { user, cases, saveCase } = useStore()
  const nav = useNavigate()
  const me = user!
  const startedAt = useRef(Date.now())
  const [step, setStep] = useState(0)
  const [proc, setProc] = useState<ProcedureRecord | 'new' | null>(null)
  const [f, setF] = useState<Form>(() => ({
    date: todayISO(),
    startTime: defaultTime(),
    shift: 'ordinaria',
    comorbidities: [],
    usualForGrade: true,
    criticalEvent: false,
    criticalEventNote: '',
    procedures: [],
    residentReflection: '',
    residentNote: '',
  }))
  const up = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }))
  const name = STEPS[step]
  const caseNo = useMemo(() => cases.filter((c) => c.residentId === me.id && c.date === f.date).length + 1, [cases, me.id, f.date])
  const noAttending = f.attendingId === null

  const valid: Record<string, boolean> = {
    Identificación: !!f.area && !!f.startTime && (!!f.attendingId || (noAttending && !!f.supervisionGap)),
    'El caso': !!f.urgency && !!f.asa && !!f.anesthesia && f.usualForGrade !== undefined && f.criticalEvent !== undefined && (!f.criticalEvent || f.criticalEventNote.trim().length > 3),
    Procedimientos: true,
    Enviar: f.residentReflection.trim().length > 3,
  }

  const submit = () => {
    const c: CaseRecord = {
      id: newId('c'),
      residentId: me.id,
      attendingId: f.attendingId ?? null,
      supervisionGap: noAttending ? f.supervisionGap : undefined,
      createdAt: new Date().toISOString(),
      date: f.date,
      startTime: f.startTime,
      area: f.area!,
      shift: f.shift,
      grade: me.grade!,
      urgency: f.urgency!,
      asa: f.asa!,
      anesthesia: f.anesthesia!,
      comorbidities: f.comorbidities,
      usualForGrade: f.usualForGrade!,
      criticalEvent: f.criticalEvent!,
      criticalEventNote: f.criticalEvent ? f.criticalEventNote.trim() : undefined,
      procedures: f.procedures,
      residentReflection: f.residentReflection.trim(),
      residentNote: f.residentNote.trim() || undefined,
      status: 'pendiente',
    }
    saveCase(c)
    nav(`/r/enviado/${c.id}`, { replace: true, state: { secs: Math.round((Date.now() - startedAt.current) / 1000) } })
  }

  if (proc) {
    return (
      <>
        <TopBar title={proc === 'new' ? 'Nuevo procedimiento' : 'Editar procedimiento'} />
        <div className="screen no-tabs">
          <ProcedureFlow
            initial={proc === 'new' ? undefined : proc}
            perspective="residente"
            usedTypes={f.procedures.map((p) => p.type)}
            onCancel={() => setProc(null)}
            onDone={(p) => {
              up({ procedures: f.procedures.some((x) => x.id === p.id) ? f.procedures.map((x) => (x.id === p.id ? p : x)) : [...f.procedures, p] })
              setProc(null)
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Registrar caso" sub={`Paso ${step + 1} de ${STEPS.length} · ${name}`} back={step === 0} fallback="/r" />
      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i < step ? 'done' : i === step ? 'cur' : ''} />
        ))}
      </div>

      <div className="screen no-tabs" key={name}>
        {name === 'Identificación' && (
          <div className="question">
            <div className="q-title">¿Dónde y con quién?</div>
            <div className="q-hint">
              {fmtDateLong(f.date)} · caso #{caseNo} del día · {me.grade}
            </div>
            <div className="field-label">Fecha</div>
            <div className="row">
              <Chips
                options={[
                  { id: todayISO(), label: 'Hoy' },
                  { id: toISODate(addDays(new Date(), -1)), label: 'Ayer' },
                ]}
                value={f.date}
                onChange={(v) => up({ date: v })}
              />
              <input type="time" className="input" style={{ width: 142, marginLeft: 'auto', padding: '13px 10px' }} value={f.startTime} onChange={(e) => up({ startTime: e.target.value })} aria-label="Hora de inicio" />
            </div>
            <div className="field-label">Área</div>
            <div className="choices">
              {AREAS.map((a) => (
                <button key={a.id} className={`choice${f.area === a.id ? ' on' : ''}`} onClick={() => up({ area: a.id })}>
                  <span className="grow">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="field-label">Jornada</div>
            <div className="big-choices">
              {SHIFTS.map((s) => (
                <button key={s.id} className={`big-choice${f.shift === s.id ? ' on' : ''}`} style={{ flexDirection: 'column', gap: 0, height: 72, fontSize: 16 }} onClick={() => up({ shift: s.id })}>
                  {s.label}
                  <span className="tiny muted" style={{ fontWeight: 600 }}>
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
            <div className="field-label">¿Quién te supervisó?</div>
            <div className="list">
              {ATTENDINGS.map((a) => (
                <button key={a.id} className="list-row" style={f.attendingId === a.id ? { background: '#f0f6f7' } : undefined} onClick={() => up({ attendingId: a.id, supervisionGap: undefined })}>
                  <Avatar name={a.name} att />
                  <span className="grow">
                    <div className="bold">{a.short}</div>
                    <div className="tiny muted">{a.title}</div>
                  </span>
                  {f.attendingId === a.id && <Check size={18} color="var(--brand)" />}
                </button>
              ))}
              <button className="list-row" style={noAttending ? { background: 'var(--crit-soft)' } : undefined} onClick={() => up({ attendingId: null })}>
                <span className="avatar" style={{ background: 'var(--crit-soft)', color: '#a32424' }}>
                  <ShieldAlert size={18} />
                </span>
                <span className="grow">
                  <div className="bold">Sin adscrito</div>
                  <div className="tiny muted">No hubo un adscrito presente en el caso</div>
                </span>
                {noAttending && <Check size={18} color="var(--crit)" />}
              </button>
            </div>
            {noAttending && (
              <>
                <div className="field-label">¿Estuviste solo?</div>
                <div className="big-choices">
                  <button className={`big-choice${f.supervisionGap === 'solo' ? ' on' : ''}`} style={{ height: 72, fontSize: 15 }} onClick={() => up({ supervisionGap: 'solo' })}>
                    Estuve solo
                  </button>
                  <button
                    className={`big-choice${f.supervisionGap === 'residente-mayor' ? ' on' : ''}`}
                    style={{ height: 72, fontSize: 15 }}
                    onClick={() => up({ supervisionGap: 'residente-mayor' })}
                  >
                    Con un residente de mayor jerarquía
                  </button>
                </div>
                <div className="card flat mt12" style={{ background: 'var(--crit-soft)', border: 0 }}>
                  <div className="small bold" style={{ color: '#a32424' }}>
                    Este caso se notifica a todos los profesores
                  </div>
                  <div className="tiny ink2" style={{ marginTop: 4 }}>
                    Por normativa, un caso sin supervisión representa un riesgo para el paciente y tiene que revisarse.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {name === 'El caso' && (
          <div className="question">
            <div className="q-title">Contexto clínico</div>
            <div className="field-label">Urgente o electivo</div>
            <div className="big-choices">
              {(['electivo', 'urgente'] as const).map((u) => (
                <button key={u} className={`big-choice${f.urgency === u ? ' on' : ''}`} style={{ height: 56, fontSize: 16 }} onClick={() => up({ urgency: u })}>
                  {u === 'electivo' ? 'Electivo' : 'Urgente'}
                </button>
              ))}
            </div>
            <div className="field-label">
              ASA <span className="muted">{f.urgency === 'urgente' && f.asa ? `Se registrará ASA ${f.asa}E` : ''}</span>
            </div>
            <div className="seg">
              {ASA_OPTIONS.map((n) => (
                <button key={n} className={f.asa === n ? 'on' : ''} style={{ height: 50, fontSize: 17 }} onClick={() => up({ asa: n })}>
                  {n}
                </button>
              ))}
            </div>
            <div className="field-label">Tipo de anestesia</div>
            <Chips options={ANESTHESIA} value={f.anesthesia} onChange={(v) => up({ anesthesia: v })} />
            <div className="field-label">Comorbilidades relevantes</div>
            <MultiChips small options={COMORBIDITIES} value={f.comorbidities} onChange={(v) => up({ comorbidities: v })} />
            <div className="field-label">¿Fue un caso habitual para tu grado?</div>
            <YesNo neutral value={f.usualForGrade} onPick={(v) => up({ usualForGrade: v })} />
            <div className="field-label">¿Hubo evento crítico o cambio inesperado?</div>
            <YesNo neutral value={f.criticalEvent} onPick={(v) => up({ criticalEvent: v })} />
            {f.criticalEvent && (
              <>
                <div className="field-label">
                  ¿Qué pasó? <span style={{ color: 'var(--crit)' }}>*</span>
                </div>
                <textarea className="textarea" autoFocus placeholder="Describe brevemente el evento y cómo se manejó" value={f.criticalEventNote} onChange={(e) => up({ criticalEventNote: e.target.value })} />
              </>
            )}
          </div>
        )}

        {name === 'Procedimientos' && (
          <div className="question">
            <div className="q-title">¿Hiciste algún procedimiento?</div>
            <div className="q-hint">Cada procedimiento se evalúa por separado y alimenta su curva CUSUM.</div>
            <div className="stack">
              {f.procedures.map((p) => (
                <div key={p.id} className="card tight">
                  <ProcLine p={p} />
                  <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm ghost" onClick={() => up({ procedures: f.procedures.filter((x) => x.id !== p.id) })}>
                      <Trash2 size={15} /> Quitar
                    </button>
                    <button className="btn sm" onClick={() => setProc(p)}>
                      <Pencil size={15} /> Editar
                    </button>
                  </div>
                </div>
              ))}
              <button className="btn block" style={{ height: 58, border: '1.5px dashed var(--line-2)', boxShadow: 'none' }} onClick={() => setProc('new')}>
                <Plus size={20} /> {f.procedures.length ? 'Agregar otro procedimiento' : 'Agregar procedimiento'}
              </button>
              {!f.procedures.length && <div className="small muted center">Si no hubo procedimiento específico, continúa: se evaluará el caso completo.</div>}
            </div>
          </div>
        )}

        {name === 'Enviar' && (
          <div className="question">
            <div className="q-title">Tu autoevaluación</div>
            <div className="card">
              <div className="row between">
                <span className="bold">{AREAS.find((a) => a.id === f.area)?.label}</span>
                <span className="badge">
                  ASA {f.asa}
                  {f.urgency === 'urgente' ? 'E' : ''}
                </span>
              </div>
              <div className="small muted">
                {f.startTime} · {SHIFTS.find((s) => s.id === f.shift)?.label} · {ANESTHESIA.find((a) => a.id === f.anesthesia)?.label}
              </div>
              {f.procedures.length > 0 && (
                <div className="stack mt12" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  {f.procedures.map((p) => (
                    <ProcLine key={p.id} p={p} compact />
                  ))}
                </div>
              )}
            </div>
            <div className="field-label">
              ¿Identificaste alguna fortaleza, dificultad u oportunidad de mejora? <span style={{ color: 'var(--crit)' }}>*</span>
            </div>
            <textarea
              className="textarea"
              placeholder="Ej. Logré la intubación al segundo intento; me falta alinear mejor los ejes."
              value={f.residentReflection}
              onChange={(e) => up({ residentReflection: e.target.value })}
            />
            <div className="field-label">¿Algo que quieras que tu adscrito sepa? (opcional)</div>
            <textarea className="textarea" style={{ minHeight: 64 }} value={f.residentNote} onChange={(e) => up({ residentNote: e.target.value })} />
            <div className="card flat mt16 row" style={{ background: noAttending ? 'var(--crit-soft)' : 'var(--accent-soft)', border: 0 }}>
              {noAttending ? (
                <div className="small">
                  Al no haber adscrito, este caso se manda a <b>revisión de los profesores</b>.
                </div>
              ) : (
                <>
                  <Avatar name={userById(f.attendingId!).name} att />
                  <div className="small">
                    <b>{userById(f.attendingId!).short}</b> recibirá el caso para evaluarlo.
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fixed-bottom footer-bar">
        <button className="btn" onClick={() => (step === 0 ? nav('/r') : setStep(step - 1))}>
          Atrás
        </button>
        <button className="btn primary grow" disabled={!valid[name]} onClick={() => (name === 'Enviar' ? submit() : setStep(step + 1))}>
          {name === 'Enviar' ? 'Enviar' : 'Siguiente'}
        </button>
      </div>
    </>
  )
}
