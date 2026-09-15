import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { newId, useStore } from '../store'
import type { AnesthesiaType, CaseRecord, Complexity, CriticalEvent, ProcedureRecord, Role, Shift, Urgency } from '../types'
import { ANESTHESIA, COMORBIDITIES, COMPLEXITY, CRITICAL, ROOMS, SHIFTS, SPECIALTIES } from '../data/catalog'
import { ATTENDINGS, RESIDENTS, userById } from '../data/users'
import { todayISO, toISODate, addDays, fmtDateLong } from '../lib/dates'
import { Avatar, Chips, MultiChips, TopBar, YesNo } from '../components/ui'
import { ProcedureFlow } from '../components/ProcedureFlow'
import { ProcLine } from '../components/case'

interface Form {
  date: string
  startTime: string
  room?: string
  shift: Shift
  attendingId?: string
  specialty?: string
  surgery: string
  urgency?: Urgency
  asa?: CaseRecord['asa']
  complexity?: Complexity
  anesthesia?: AnesthesiaType
  comorbidities: string[]
  usualForGrade?: boolean
  criticalEvent: CriticalEvent
  procedures: ProcedureRecord[]
  residentNote: string
}

function defaultTime() {
  const d = new Date(Date.now() - 2 * 3600_000)
  const h = Math.max(7, d.getHours())
  return `${String(h).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`
}

export default function NewCase({ mode }: { mode: Role }) {
  const { user, cases, saveCase } = useStore()
  const nav = useNavigate()
  const startedAt = useRef(Date.now())
  const isAtt = mode === 'adscrito'
  const steps = isAtt ? ['Residente', 'Identificación', 'Cirugía', 'Contexto', 'Procedimientos'] : ['Identificación', 'Cirugía', 'Contexto', 'Procedimientos', 'Enviar']
  const [step, setStep] = useState(0)
  const [residentId, setResidentId] = useState<string | undefined>(isAtt ? undefined : user!.id)
  const [proc, setProc] = useState<ProcedureRecord | 'new' | null>(null)
  const [customSurgery, setCustomSurgery] = useState(false)
  const [f, setF] = useState<Form>(() => ({
    date: todayISO(),
    startTime: defaultTime(),
    shift: 'ordinaria',
    attendingId: isAtt ? user!.id : undefined,
    surgery: '',
    comorbidities: [],
    usualForGrade: true,
    criticalEvent: 'no',
    procedures: [],
    residentNote: '',
  }))
  const up = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }))
  const name = steps[step]
  const resident = residentId ? userById(residentId) : undefined
  const caseNo = useMemo(() => cases.filter((c) => c.residentId === residentId && c.date === f.date).length + 1, [cases, residentId, f.date])
  const spec = SPECIALTIES.find((s) => s.id === f.specialty)

  const valid: Record<string, boolean> = {
    Residente: !!residentId,
    Identificación: !!f.room && !!f.attendingId && !!f.startTime,
    Cirugía: !!f.specialty && !!f.surgery.trim() && !!f.urgency && !!f.asa,
    Contexto: !!f.anesthesia && !!f.complexity && f.usualForGrade !== undefined,
    Procedimientos: true,
    Enviar: true,
  }

  const submit = () => {
    const c: CaseRecord = {
      id: newId('c'),
      residentId: residentId!,
      attendingId: f.attendingId!,
      createdBy: mode,
      createdAt: new Date().toISOString(),
      date: f.date,
      startTime: f.startTime,
      room: f.room!,
      shift: f.shift,
      grade: resident!.grade!,
      specialty: f.specialty!,
      surgery: f.surgery.trim(),
      urgency: f.urgency!,
      asa: f.asa!,
      complexity: f.complexity!,
      anesthesia: f.anesthesia!,
      comorbidities: f.comorbidities,
      usualForGrade: f.usualForGrade!,
      criticalEvent: f.criticalEvent,
      procedures: f.procedures,
      residentNote: f.residentNote.trim() || undefined,
      status: 'pendiente',
    }
    saveCase(c)
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    if (isAtt) nav(`/a/evaluar/${c.id}`, { replace: true, state: { startedAt: startedAt.current } })
    else nav(`/r/enviado/${c.id}`, { replace: true, state: { secs } })
  }

  const next = () => (step === steps.length - 1 || (isAtt && name === 'Procedimientos') ? submit() : setStep(step + 1))
  const back = () => (step === 0 ? nav(-1) : setStep(step - 1))

  // Pantalla del flujo de procedimiento (reemplaza el paso mientras se captura)
  if (proc) {
    return (
      <>
        <TopBar title={proc === 'new' ? 'Nuevo procedimiento' : 'Editar procedimiento'} sub={resident?.short} back={false} />
        <div className="screen no-tabs">
          <ProcedureFlow
            initial={proc === 'new' ? undefined : proc}
            perspective={mode}
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
      <TopBar title={isAtt ? 'Nueva evaluación' : 'Registrar caso'} sub={`Paso ${step + 1} de ${steps.length} · ${name}`} back={step === 0 ? true : false} />
      <div className="steps">
        {steps.map((s, i) => (
          <span key={s} className={i < step ? 'done' : i === step ? 'cur' : ''} />
        ))}
      </div>

      <div className="screen no-tabs" key={name}>
        {name === 'Residente' && (
          <div className="question">
            <div className="q-title">¿A quién evalúas?</div>
            {(['R1', 'R2', 'R3'] as const).map((g) => (
              <div key={g}>
                <div className="field-label">{g}</div>
                <div className="list">
                  {RESIDENTS.filter((r) => r.grade === g).map((r) => (
                    <button
                      key={r.id}
                      className="list-row"
                      style={residentId === r.id ? { background: '#f0f6f7' } : undefined}
                      onClick={() => {
                        setResidentId(r.id)
                        setStep(1)
                      }}
                    >
                      <Avatar name={r.name} />
                      <span className="grow bold">{r.short}</span>
                      {residentId === r.id && <Check size={18} color="var(--brand)" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {name === 'Identificación' && (
          <div className="question">
            <div className="q-title">{isAtt ? `Caso de ${resident?.name.split(' ')[0]}` : '¿Dónde y con quién?'}</div>
            <div className="q-hint">
              {fmtDateLong(f.date)} · caso #{caseNo} del día {resident?.grade && `· ${resident.grade}`}
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
              <input type="time" className="input" style={{ width: 120, marginLeft: 'auto' }} value={f.startTime} onChange={(e) => up({ startTime: e.target.value })} aria-label="Hora de inicio" />
            </div>
            <div className="field-label">Quirófano</div>
            <Chips options={ROOMS.map((r) => ({ id: r, label: r }))} value={f.room} onChange={(v) => up({ room: v })} />
            <div className="field-label">Jornada</div>
            <Chips options={SHIFTS} value={f.shift} onChange={(v) => up({ shift: v })} />
            {!isAtt && (
              <>
                <div className="field-label">Adscrito que te supervisó</div>
                <div className="list">
                  {ATTENDINGS.map((a) => (
                    <button key={a.id} className="list-row" style={f.attendingId === a.id ? { background: '#f0f6f7' } : undefined} onClick={() => up({ attendingId: a.id })}>
                      <Avatar name={a.name} att />
                      <span className="grow">
                        <div className="bold">{a.short}</div>
                        <div className="tiny muted">{a.title}</div>
                      </span>
                      {f.attendingId === a.id && <Check size={18} color="var(--brand)" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {name === 'Cirugía' && (
          <div className="question">
            <div className="q-title">¿Qué cirugía fue?</div>
            <div className="field-label">Especialidad</div>
            <Chips
              options={SPECIALTIES.map((s) => ({ id: s.id, label: s.label }))}
              value={f.specialty}
              onChange={(v) => {
                up({ specialty: v, surgery: '' })
                setCustomSurgery(false)
              }}
            />
            {spec && (
              <>
                <div className="field-label">Procedimiento quirúrgico</div>
                <div className="chips">
                  {spec.surgeries.map((s) => (
                    <button
                      key={s}
                      className={`chip${f.surgery === s && !customSurgery ? ' on' : ''}`}
                      onClick={() => {
                        up({ surgery: s })
                        setCustomSurgery(false)
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    className={`chip${customSurgery ? ' on' : ''}`}
                    onClick={() => {
                      setCustomSurgery(true)
                      up({ surgery: '' })
                    }}
                  >
                    Otra…
                  </button>
                </div>
                {customSurgery && <input className="input mt8" autoFocus placeholder="Escribe la cirugía" value={f.surgery} onChange={(e) => up({ surgery: e.target.value })} />}
              </>
            )}
            <div className="field-label">Urgente / electivo</div>
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
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} className={f.asa === n ? 'on' : ''} style={{ height: 50, fontSize: 17 }} onClick={() => up({ asa: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {name === 'Contexto' && (
          <div className="question">
            <div className="q-title">Contexto clínico</div>
            <div className="field-label">Tipo de anestesia</div>
            <Chips options={ANESTHESIA} value={f.anesthesia} onChange={(v) => up({ anesthesia: v })} />
            <div className="field-label">Complejidad relativa</div>
            <Chips options={COMPLEXITY} value={f.complexity} onChange={(v) => up({ complexity: v })} />
            <div className="field-label">Comorbilidades relevantes</div>
            <MultiChips small options={COMORBIDITIES} value={f.comorbidities} onChange={(v) => up({ comorbidities: v })} />
            <div className="field-label">¿Fue un caso habitual para {isAtt ? 'su' : 'tu'} grado?</div>
            <YesNo neutral value={f.usualForGrade} onPick={(v) => up({ usualForGrade: v })} />
            <div className="field-label">¿Hubo evento crítico o cambio inesperado?</div>
            <Chips options={CRITICAL} value={f.criticalEvent} onChange={(v) => up({ criticalEvent: v })} />
          </div>
        )}

        {name === 'Procedimientos' && (
          <div className="question">
            <div className="q-title">¿{isAtt ? 'Hizo' : 'Hiciste'} algún procedimiento?</div>
            <div className="q-hint">Intubación, bloqueos, accesos… Cada uno alimenta su curva CUSUM.</div>
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
              {!f.procedures.length && <div className="small muted center">Si no hubo procedimiento específico, continúa: se evaluará como caso global.</div>}
            </div>
          </div>
        )}

        {name === 'Enviar' && (
          <div className="question">
            <div className="q-title">Todo listo</div>
            <div className="card">
              <div className="row between">
                <span className="bold">{f.surgery}</span>
                <span className="badge">
                  ASA {f.asa}
                  {f.urgency === 'urgente' ? 'E' : ''}
                </span>
              </div>
              <div className="small muted">
                {SPECIALTIES.find((s) => s.id === f.specialty)?.label} · {f.room} · {f.startTime} · {ANESTHESIA.find((a) => a.id === f.anesthesia)?.label}
              </div>
              {f.procedures.length > 0 && (
                <div className="stack mt12" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  {f.procedures.map((p) => (
                    <ProcLine key={p.id} p={p} compact />
                  ))}
                </div>
              )}
            </div>
            <div className="field-label">¿Algo que quieras que tu adscrito sepa? (opcional)</div>
            <textarea className="textarea" placeholder="Ej. Me costó la visualización, quiero repasar la técnica…" value={f.residentNote} onChange={(e) => up({ residentNote: e.target.value })} />
            <div className="card flat mt16 row" style={{ background: 'var(--accent-soft)', border: 0 }}>
              <Avatar name={userById(f.attendingId!).name} att />
              <div className="small">
                <b>{userById(f.attendingId!).short}</b> recibirá el caso para evaluarlo (≈ 2 min).
              </div>
            </div>
          </div>
        )}
      </div>

      {name !== 'Residente' && (
        <div className="fixed-bottom footer-bar">
          <button className="btn" onClick={back}>
            Atrás
          </button>
          <button className="btn primary grow" disabled={!valid[name]} onClick={next}>
            {name === 'Enviar' ? `Enviar a ${userById(f.attendingId!).short}` : isAtt && name === 'Procedimientos' ? 'Continuar a evaluación' : 'Siguiente'}
          </button>
        </div>
      )}
    </>
  )
}
