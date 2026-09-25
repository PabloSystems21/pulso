import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Check, ShieldAlert, Timer } from 'lucide-react'
import { useStore } from '../store'
import type { Evaluation, ProcedureRecord, Score4, Score5 } from '../types'
import {
  ANESTHESIA_LABEL,
  ANTS_DOMAINS,
  ANTS_ITEMS,
  AREA_LABEL,
  BEST_SUGGESTIONS,
  ENTRUSTMENT,
  IMPROVE_SUGGESTIONS,
  MINICEX_ITEMS,
  SCALE4_LABELS,
  SCALE5_LABELS,
  SHIFT_LABEL,
  SUPERVISION,
  type Item,
} from '../data/catalog'
import { userById } from '../data/users'
import { fmtDateLong, fmtDuration } from '../lib/dates'
import { procLabel } from '../lib/stats'
import { Avatar, ChoiceList, ScaleSeg, TopBar, YesNo } from '../components/ui'
import { ProcLine } from '../components/case'

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

function ItemBlock<T extends number | null>({
  items,
  values,
  max,
  onChange,
  groups,
}: {
  items: Item[]
  values: Record<string, T | undefined>
  max: 4 | 5
  onChange: (id: string, v: T) => void
  groups?: { id: string; label: string; ids: string[] }[]
}) {
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
      <div className="tiny muted">{labels.map((l, i) => `${i + 1} ${l}`).join(' · ')} · N/O no observado</div>
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

type StepKind = 'caso' | 'oscore' | 'entrust' | 'ants' | 'cex' | 'retro' | 'cierre'

export default function Evaluate() {
  const { id } = useParams()
  const { user, cases, saveCase } = useStore()
  const nav = useNavigate()
  const c = cases.find((x) => x.id === id)
  const startedAt = useRef(Date.now())
  const submitted = useRef(false)
  const [step, setStep] = useState(0)
  const [supervision, setSupervision] = useState<Record<string, 1 | 2 | 3 | 4 | 5 | undefined>>({})
  const [entrustment, setEntrustment] = useState<Evaluation['entrustment']>()
  const [ants, setAnts] = useState<Record<string, Score4 | undefined>>({})
  const [miniCex, setMiniCex] = useState<Record<string, Score5 | undefined>>({})
  const [best, setBest] = useState('')
  const [improve, setImprove] = useState('')
  const [comments, setComments] = useState('')
  const [needsReview, setNeedsReview] = useState<boolean | undefined>(false)
  const [risk, setRisk] = useState<boolean | undefined>(false)
  const [riskNote, setRiskNote] = useState('')

  const steps = useMemo(() => {
    const procs: ProcedureRecord[] = c?.procedures ?? []
    return [
      { key: 'caso', name: 'Caso', kind: 'caso' as StepKind, proc: undefined as ProcedureRecord | undefined },
      ...procs.map((p) => ({ key: `o-${p.id}`, name: 'O-SCORE', kind: 'oscore' as StepKind, proc: p })),
      { key: 'entrust', name: 'Entrustment', kind: 'entrust' as StepKind, proc: undefined },
      { key: 'ants', name: 'ANTS', kind: 'ants' as StepKind, proc: undefined },
      { key: 'cex', name: 'Mini-CEX', kind: 'cex' as StepKind, proc: undefined },
      { key: 'retro', name: 'Retroalimentación', kind: 'retro' as StepKind, proc: undefined },
      { key: 'cierre', name: 'Cierre', kind: 'cierre' as StepKind, proc: undefined },
    ]
  }, [c])

  if (!c) return null
  // Solo evalúa el adscrito asignado; los casos sin adscrito los toma cualquier profesor
  if (c.attendingId && c.attendingId !== user!.id && !user!.profesor) return <Navigate to="/a" replace />
  if (c.status === 'evaluado') return submitted.current ? null : <Navigate to={`/a/caso/${c.id}`} replace />

  const resident = userById(c.residentId)
  const cur = steps[step]
  const allAnswered = (items: Item[], v: Record<string, unknown>) => items.every((i) => v[i.id] !== undefined)
  const valid =
    cur.kind === 'caso'
      ? true
      : cur.kind === 'oscore'
        ? !!supervision[cur.proc!.id]
        : cur.kind === 'entrust'
          ? !!entrustment
          : cur.kind === 'ants'
            ? allAnswered(ANTS_ITEMS, ants)
            : cur.kind === 'cex'
              ? allAnswered(MINICEX_ITEMS, miniCex)
              : cur.kind === 'retro'
                ? best.trim().length > 2 && improve.trim().length > 2
                : needsReview !== undefined && risk !== undefined && (!risk || riskNote.trim().length > 3)

  const advance = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const autoNext = () => setTimeout(advance, 220)

  const submit = () => {
    const pick = <T,>(items: Item[], v: Record<string, T | undefined>) => Object.fromEntries(items.map((i) => [i.id, v[i.id] ?? null])) as Record<string, T>
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
    const evaluation: Evaluation = {
      attendingId: user!.id,
      evaluatedAt: new Date().toISOString(),
      durationSec,
      supervision: Object.fromEntries(c.procedures.map((p) => [p.id, supervision[p.id]!])),
      entrustment: entrustment!,
      ants: pick<Score4>(ANTS_ITEMS, ants),
      miniCex: pick<Score5>(MINICEX_ITEMS, miniCex),
      best: best.trim(),
      improve: improve.trim(),
      comments: comments.trim() || undefined,
      needsProfessorReview: !!needsReview || !!risk,
      patientRisk: !!risk,
      patientRiskNote: risk ? riskNote.trim() : undefined,
    }
    submitted.current = true
    saveCase({ ...c, status: 'evaluado', evaluation })
    nav(`/a/listo/${c.id}`, { replace: true, state: { secs: durationSec } })
  }

  return (
    <>
      <TopBar
        title={`Evaluar a ${resident.name.split(' ')[0]}`}
        sub={`${cur.name} · ${step + 1}/${steps.length}`}
        back={step === 0}
        fallback="/a"
        right={<LiveTimer since={startedAt.current} />}
      />
      <div className="steps">
        {steps.map((s, i) => (
          <span key={s.key} className={i < step ? 'done' : i === step ? 'cur' : ''} />
        ))}
      </div>

      <div className="screen no-tabs" key={cur.key}>
        {cur.kind === 'caso' && (
          <div className="question">
            <div className="card">
              <div className="row">
                <Avatar name={resident.name} lg />
                <div className="grow">
                  <div className="bold" style={{ fontSize: 17 }}>
                    {resident.short}
                  </div>
                  <div className="small muted">
                    {c.grade} · {fmtDateLong(c.date)}
                  </div>
                </div>
              </div>
              <div className="row wrap mt16" style={{ gap: 6 }}>
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
                <div className="card flat mt12" style={{ background: 'var(--crit-soft)', border: 0 }}>
                  <div className="row">
                    <ShieldAlert size={18} color="var(--crit)" />
                    <div className="small bold" style={{ color: '#a32424' }}>
                      Caso sin adscrito · {c.supervisionGap === 'residente-mayor' ? 'con residente de mayor jerarquía' : 'el residente estuvo solo'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h2">Autoevaluación del residente</div>
            <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <div className="tiny muted bold">FORTALEZA, DIFICULTAD U OPORTUNIDAD</div>
              <div className="small">"{c.residentReflection}"</div>
              {c.residentNote && (
                <>
                  <div className="tiny muted bold mt12">NOTA PARA TI</div>
                  <div className="small">"{c.residentNote}"</div>
                </>
              )}
            </div>

            {c.procedures.length > 0 && (
              <>
                <div className="h2">Procedimientos reportados</div>
                <div className="stack">
                  {c.procedures.map((p) => (
                    <div key={p.id} className="card tight">
                      <ProcLine p={p} />
                      {p.notes && <div className="small ink2 mt8">{p.notes}</div>}
                    </div>
                  ))}
                </div>
                <div className="tiny muted mt8">Vas a calificar cada procedimiento por separado ({c.procedures.length} en total), y el caso completo al final.</div>
              </>
            )}
          </div>
        )}

        {cur.kind === 'oscore' && (
          <div className="question">
            <div className="q-hint" style={{ margin: '0 2px 4px' }}>
              Durante {procLabel(cur.proc!).toLowerCase()}
            </div>
            <div className="q-title">El nivel de apoyo que requirió fue…</div>
            <ChoiceList
              numbered
              value={supervision[cur.proc!.id]}
              onPick={(v) => {
                setSupervision((x) => ({ ...x, [cur.proc!.id]: v }))
                autoNext()
              }}
              options={SUPERVISION.map((s) => ({ v: s.v, title: s.text }))}
            />
          </div>
        )}

        {cur.kind === 'entrust' && (
          <div className="question">
            <div className="q-hint" style={{ margin: '0 2px 4px' }}>
              Viendo el caso completo
            </div>
            <div className="q-title">{resident.name.split(' ')[0]} está listo para…</div>
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

        {cur.kind === 'ants' && (
          <div className="question">
            <div className="q-title">Habilidades no técnicas (ANTS)</div>
            <div className="q-hint">Se evalúan por caso, no por procedimiento.</div>
            <ItemBlock
              items={ANTS_ITEMS}
              values={ants}
              max={4}
              onChange={(k, v) => setAnts((x) => ({ ...x, [k]: v }))}
              groups={ANTS_DOMAINS.map((d) => ({ id: d.id, label: d.label, ids: ANTS_ITEMS.filter((i) => i.domain === d.id).map((i) => i.id) }))}
            />
          </div>
        )}

        {cur.kind === 'cex' && (
          <div className="question">
            <div className="q-title">Mini-CEX perioperatorio</div>
            <div className="q-hint">Saberes clínicos y juicio aplicado al caso.</div>
            <ItemBlock items={MINICEX_ITEMS} values={miniCex} max={5} onChange={(k, v) => setMiniCex((x) => ({ ...x, [k]: v }))} />
          </div>
        )}

        {cur.kind === 'retro' && (
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
            <div className="field-label">Comentarios adicionales (opcional)</div>
            <textarea className="textarea" style={{ minHeight: 64 }} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Contexto del caso, algo extra que quieras dejar asentado…" />
          </div>
        )}

        {cur.kind === 'cierre' && (
          <div className="question">
            <div className="q-title">Cierre</div>
            <div className="field-label">¿Este caso amerita revisión de un profesor?</div>
            <YesNo neutral value={needsReview} onPick={setNeedsReview} />
            {needsReview && <div className="tiny muted mt8">El caso quedará marcado hasta que un profesor lo valide.</div>}
            <div className="field-label">¿Hubo riesgo para el paciente atribuible al desempeño del residente?</div>
            <YesNo neutral value={risk} onPick={setRisk} />
            {risk && (
              <>
                <div className="field-label">
                  ¿Qué pasó? <span style={{ color: 'var(--crit)' }}>*</span>
                </div>
                <textarea className="textarea" autoFocus value={riskNote} onChange={(e) => setRiskNote(e.target.value)} placeholder="Describe el riesgo y cómo se resolvió" />
                <div className="tiny muted mt8">Los casos con riesgo se notifican a todos los profesores.</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="fixed-bottom footer-bar">
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            Atrás
          </button>
        )}
        <button className="btn primary grow" disabled={!valid} onClick={cur.kind === 'cierre' ? submit : advance}>
          {cur.kind === 'caso' ? (
            'Comenzar evaluación'
          ) : cur.kind === 'cierre' ? (
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
