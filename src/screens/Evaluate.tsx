import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check, Pencil, Timer } from 'lucide-react'
import { useStore } from '../store'
import type { Evaluation, FollowUp, PatientRisk, ProcedureRecord, Score4, Score5 } from '../types'
import {
  ANESTHESIA_LABEL,
  ANTS_DOMAINS,
  ANTS_ITEMS,
  BEST_SUGGESTIONS,
  ENTRUSTMENT,
  FOLLOWUP,
  GLOBAL_ITEMS,
  IMPROVE_SUGGESTIONS,
  MINICEX_ITEMS,
  PROF_ITEMS,
  RISK,
  SCALE4_LABELS,
  SCALE5_LABELS,
  SHIFT_LABEL,
  SUPERVISION,
  specialtyLabel,
  type Item,
} from '../data/catalog'
import { userById } from '../data/users'
import { fmtDateLong, fmtDuration } from '../lib/dates'
import { Avatar, ChoiceList, Chips, ScaleSeg, TopBar, YesNo } from '../components/ui'
import { ProcLine } from '../components/case'
import { ProcedureFlow } from '../components/ProcedureFlow'

function LiveTimer({ since }: { since: number }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="badge brand num">
      <Timer size={12} /> {fmtDuration((Date.now() - since) / 1000)}
    </span>
  )
}

function ItemBlock<T extends number | null>({ items, values, max, onChange, groups }: { items: Item[]; values: Record<string, T | undefined>; max: 4 | 5; onChange: (id: string, v: T) => void; groups?: { id: string; label: string; ids: string[] }[] }) {
  const labels = max === 5 ? SCALE5_LABELS : SCALE4_LABELS
  const render = (list: Item[]) =>
    list.map((i) => (
      <div key={i.id} className="card tight">
        <div className="small bold" style={{ marginBottom: 8 }}>
          {i.label}
        </div>
        <ScaleSeg max={max} value={values[i.id]} onChange={(v) => onChange(i.id, v as T)} />
        {typeof values[i.id] === 'number' && (
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {labels[(values[i.id] as number) - 1]}
          </div>
        )}
      </div>
    ))
  return (
    <div className="stack">
      <div className="tiny muted" style={{ marginBottom: 2 }}>
        {labels.map((l, i) => `${i + 1} ${l}`).join(' · ')} · N/O no observado
      </div>
      {groups
        ? groups.map((g) => {
            const list = items.filter((i) => g.ids.includes(i.id))
            if (!list.length) return null
            return (
              <div key={g.id} className="stack">
                <div className="field-label" style={{ margin: '8px 2px 0' }}>
                  {g.label}
                </div>
                {render(list)}
              </div>
            )
          })
        : render(items)}
    </div>
  )
}

function Suggest({ options, onPick }: { options: string[]; onPick: (s: string) => void }) {
  return (
    <div className="chips" style={{ marginTop: 8 }}>
      {options.map((s) => (
        <button key={s} type="button" className="chip sm" onClick={() => onPick(s)}>
          + {s}
        </button>
      ))}
    </div>
  )
}

export default function Evaluate() {
  const { id } = useParams()
  const { user, cases, saveCase } = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const c = cases.find((x) => x.id === id)
  const startedAt = useRef((loc.state as { startedAt?: number } | null)?.startedAt ?? Date.now())
  const submitted = useRef(false)
  const [version, setVersion] = useState<'corta' | 'completa'>('corta')
  const [step, setStep] = useState(0)
  const [procs, setProcs] = useState<ProcedureRecord[]>(c?.procedures ?? [])
  const [editProc, setEditProc] = useState<ProcedureRecord | null>(null)
  const [supervision, setSupervision] = useState<Evaluation['supervision']>()
  const [entrustment, setEntrustment] = useState<Evaluation['entrustment']>()
  const [ants, setAnts] = useState<Record<string, Score4 | undefined>>({})
  const [miniCex, setMiniCex] = useState<Record<string, Score5 | undefined>>({})
  const [global, setGlobal] = useState<Record<string, Score5 | undefined>>({})
  const [prof, setProf] = useState<Record<string, Score5 | undefined>>({})
  const [best, setBest] = useState('')
  const [improve, setImprove] = useState('')
  const [plan, setPlan] = useState('')
  const [counts, setCounts] = useState<boolean | undefined>(true)
  const [followUp, setFollowUp] = useState<FollowUp>('no')
  const [risk, setRisk] = useState<PatientRisk>('no')

  const full = version === 'completa'
  const antsItems = ANTS_ITEMS.filter((i) => full || i.short)
  const cexItems = MINICEX_ITEMS.filter((i) => full || i.short)
  const steps = useMemo(
    () => ['Caso', 'Supervisión', 'Prospectiva', ...(full ? ['Desempeño global'] : []), 'Juicio clínico', 'ANTS', ...(full ? ['Profesionalismo'] : []), 'Retroalimentación', 'Cierre'],
    [full],
  )

  if (!c) return null
  // Si ya estaba evaluado al abrir, mostrar el detalle; si lo acabamos de enviar, dejar que navegue a "listo"
  if (c.status === 'evaluado') return submitted.current ? null : <Navigate to={`/a/caso/${c.id}`} replace />
  const resident = userById(c.residentId)
  const name = steps[step]
  const allAnswered = (items: Item[], v: Record<string, unknown>) => items.every((i) => v[i.id] !== undefined)

  const valid: Record<string, boolean> = {
    Caso: true,
    Supervisión: !!supervision,
    Prospectiva: !!entrustment,
    'Desempeño global': allAnswered(GLOBAL_ITEMS, global),
    'Juicio clínico': allAnswered(cexItems, miniCex),
    ANTS: allAnswered(antsItems, ants),
    Profesionalismo: allAnswered(PROF_ITEMS, prof),
    Retroalimentación: best.trim().length > 2 && improve.trim().length > 2,
    Cierre: counts !== undefined,
  }

  const advance = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const autoNext = () => setTimeout(advance, 220)

  const submit = () => {
    const pickVals = <T,>(items: Item[], v: Record<string, T | undefined>) => Object.fromEntries(items.map((i) => [i.id, v[i.id] ?? null])) as Record<string, T>
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
    const evaluation: Evaluation = {
      version,
      attendingId: user!.id,
      evaluatedAt: new Date().toISOString(),
      durationSec,
      supervision: supervision!,
      entrustment: entrustment!,
      ants: pickVals<Score4>(antsItems, ants),
      miniCex: pickVals<Score5>(cexItems, miniCex),
      global: full ? pickVals<Score5>(GLOBAL_ITEMS, global) : undefined,
      professionalism: full ? pickVals<Score5>(PROF_ITEMS, prof) : undefined,
      best: best.trim(),
      improve: improve.trim(),
      plan: plan.trim() || undefined,
      countsForProgression: counts!,
      followUp,
      patientRisk: risk,
      proceduresConfirmed: true,
    }
    submitted.current = true
    saveCase({ ...c, procedures: procs, attendingId: user!.id, status: 'evaluado', evaluation })
    nav(`/a/listo/${c.id}`, { replace: true, state: { secs: durationSec } })
  }

  if (editProc) {
    return (
      <>
        <TopBar title="Corregir procedimiento" sub={resident.short} />
        <div className="screen no-tabs">
          <ProcedureFlow
            initial={editProc}
            perspective="adscrito"
            onCancel={() => setEditProc(null)}
            onDone={(p) => {
              setProcs(procs.map((x) => (x.id === p.id ? p : x)))
              setEditProc(null)
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={`Evaluar a ${resident.name.split(' ')[0]}`} sub={`${name} · ${step + 1}/${steps.length}`} back={step === 0} right={<LiveTimer since={startedAt.current} />} />
      <div className="steps">
        {steps.map((s, i) => (
          <span key={s} className={i < step ? 'done' : i === step ? 'cur' : ''} />
        ))}
      </div>

      <div className="screen no-tabs" key={name}>
        {name === 'Caso' && (
          <div className="question">
            <div className="card">
              <div className="row">
                <Avatar name={resident.name} lg />
                <div className="grow">
                  <div className="bold" style={{ fontSize: 17 }}>
                    {resident.short}
                  </div>
                  <div className="small muted">
                    {c.grade} · caso de {fmtDateLong(c.date)}
                  </div>
                </div>
              </div>
              <div className="mt16" style={{ fontSize: 18, fontWeight: 800 }}>
                {c.surgery}
              </div>
              <div className="row wrap mt8" style={{ gap: 6 }}>
                <span className="badge">{specialtyLabel(c.specialty)}</span>
                <span className="badge">
                  ASA {c.asa}
                  {c.urgency === 'urgente' ? 'E' : ''}
                </span>
                <span className="badge">{ANESTHESIA_LABEL[c.anesthesia]}</span>
                <span className={`badge ${c.complexity === 'alta' ? 'warn' : ''}`}>Complejidad {c.complexity}</span>
                <span className="badge">
                  {c.room} · {c.startTime} · {SHIFT_LABEL[c.shift]}
                </span>
                {c.comorbidities.map((m) => (
                  <span key={m} className="badge brand">
                    {m}
                  </span>
                ))}
                {c.criticalEvent !== 'no' && <span className="badge crit">Evento crítico {c.criticalEvent}</span>}
                {!c.usualForGrade && <span className="badge warn">No habitual para su grado</span>}
              </div>
              {c.residentNote && (
                <div className="feedback-quote mt12">
                  <div className="tiny muted bold">NOTA DEL RESIDENTE</div>
                  <div className="small">"{c.residentNote}"</div>
                </div>
              )}
            </div>

            {procs.length > 0 && (
              <>
                <div className="h2">Procedimientos reportados</div>
                <div className="stack">
                  {procs.map((p) => (
                    <div key={p.id} className="card tight">
                      <ProcLine p={p} />
                      <div className="row mt8" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn sm" onClick={() => setEditProc(p)}>
                          <Pencil size={14} /> Corregir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="tiny muted mt8">Al enviar la evaluación confirmas estos datos; alimentan la CUSUM del residente.</div>
              </>
            )}

            <div className="h2">Versión de la evaluación</div>
            <div className="big-choices">
              <button className={`big-choice${!full ? ' on' : ''}`} style={{ flexDirection: 'column', gap: 0, height: 74 }} onClick={() => setVersion('corta')}>
                Corta<span className="tiny muted" style={{ fontWeight: 600 }}>≈ 2 min · diario</span>
              </button>
              <button className={`big-choice${full ? ' on' : ''}`} style={{ flexDirection: 'column', gap: 0, height: 74 }} onClick={() => setVersion('completa')}>
                Completa<span className="tiny muted" style={{ fontWeight: 600 }}>≈ 6 min · docente</span>
              </button>
            </div>
            {c.complexity === 'alta' && !full && <div className="small mt8" style={{ color: 'var(--warn-ink)' }}>Sugerencia: caso de complejidad alta → considera la versión completa.</div>}
          </div>
        )}

        {name === 'Supervisión' && (
          <div className="question">
            <div className="q-title">Durante este caso, el nivel de apoyo que requirió fue…</div>
            <ChoiceList
              numbered
              value={supervision}
              onPick={(v) => {
                setSupervision(v)
                autoNext()
              }}
              options={SUPERVISION.map((s) => ({ v: s.v, title: s.text }))}
            />
          </div>
        )}

        {name === 'Prospectiva' && (
          <div className="question">
            <div className="q-title">Para un caso similar, {resident.name.split(' ')[0]} está listo para…</div>
            <ChoiceList
              numbered
              value={entrustment}
              onPick={(v) => {
                setEntrustment(v)
                autoNext()
              }}
              options={ENTRUSTMENT.map((s) => ({ v: s.v, title: s.text }))}
            />
          </div>
        )}

        {name === 'Desempeño global' && (
          <div className="question">
            <div className="q-title">Desempeño global del caso</div>
            <ItemBlock items={GLOBAL_ITEMS} values={global} max={5} onChange={(k, v) => setGlobal((x) => ({ ...x, [k]: v }))} />
          </div>
        )}

        {name === 'Juicio clínico' && (
          <div className="question">
            <div className="q-title">{full ? 'Mini-CEX perioperatorio' : 'Juicio clínico aplicado'}</div>
            <ItemBlock items={cexItems} values={miniCex} max={5} onChange={(k, v) => setMiniCex((x) => ({ ...x, [k]: v }))} />
          </div>
        )}

        {name === 'ANTS' && (
          <div className="question">
            <div className="q-title">Habilidades no técnicas (ANTS)</div>
            <ItemBlock
              items={antsItems}
              values={ants}
              max={4}
              onChange={(k, v) => setAnts((x) => ({ ...x, [k]: v }))}
              groups={ANTS_DOMAINS.map((d) => ({ id: d.id, label: d.label, ids: ANTS_ITEMS.filter((i) => i.domain === d.id).map((i) => i.id) }))}
            />
          </div>
        )}

        {name === 'Profesionalismo' && (
          <div className="question">
            <div className="q-title">Profesionalismo y competencias transversales</div>
            <ItemBlock items={PROF_ITEMS} values={prof} max={5} onChange={(k, v) => setProf((x) => ({ ...x, [k]: v }))} />
          </div>
        )}

        {name === 'Retroalimentación' && (
          <div className="question">
            <div className="q-title">Retroalimentación</div>
            <div className="q-hint">Toca una sugerencia o escribe con tus palabras.</div>
            <div className="field-label">
              Lo mejor de este desempeño fue <span style={{ color: 'var(--crit)' }}>*</span>
            </div>
            <textarea className="textarea" value={best} onChange={(e) => setBest(e.target.value)} placeholder="Ej. Plan anestésico claro…" />
            <Suggest options={BEST_SUGGESTIONS} onPick={(s) => setBest((b) => (b.trim() ? `${b.trim()}. ${s}` : s))} />
            <div className="field-label">
              La prioridad de mejora para el siguiente caso es <span style={{ color: 'var(--crit)' }}>*</span>
            </div>
            <textarea className="textarea" value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="Ej. Anticipar plan B de vía aérea…" />
            <Suggest options={IMPROVE_SUGGESTIONS} onPick={(s) => setImprove((b) => (b.trim() ? `${b.trim()}. ${s}` : s))} />
            <div className="field-label">Plan concreto para el siguiente caso (opcional)</div>
            <textarea className="textarea" style={{ minHeight: 64 }} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ej. Practicar en simulador esta semana" />
          </div>
        )}

        {name === 'Cierre' && (
          <div className="question">
            <div className="q-title">Cierre</div>
            <div className="field-label">¿Este caso cuenta para la progresión del residente?</div>
            <YesNo neutral value={counts} onPick={setCounts} />
            <div className="field-label">¿Requiere seguimiento?</div>
            <ChoiceList value={followUp} onPick={setFollowUp} options={FOLLOWUP.map((f) => ({ v: f.id, title: f.label }))} />
            <div className="field-label">¿Hubo riesgo para el paciente atribuible al desempeño del residente?</div>
            <Chips options={RISK} value={risk} onChange={setRisk} />
          </div>
        )}
      </div>

      <div className="fixed-bottom footer-bar">
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            Atrás
          </button>
        )}
        <button className="btn primary grow" disabled={!valid[name]} onClick={name === 'Cierre' ? submit : advance}>
          {name === 'Caso' ? (
            'Comenzar evaluación'
          ) : name === 'Cierre' ? (
            <>
              <Check size={18} /> Enviar evaluación
            </>
          ) : (
            'Siguiente'
          )}
        </button>
      </div>
    </>
  )
}
