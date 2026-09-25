// Flujo conversacional: una pregunta a la vez, las respuestas quedan como "migajas" editables.
// "¿Lo lograste? Sí → ¿Al primer intento? No → ¿En cuál? 2º"
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import type { AttemptTime, HelpLevel, ProcedureRecord, ProcedureType, Role } from '../types'
import { ATTEMPT_TIMES, HELP, INCIDENTS, INCIDENT_OTHER, PROCEDURES, procDef } from '../data/catalog'
import { isCusumFailure } from '../lib/cusum'
import { newId } from '../store'
import { ChoiceList, MultiChips, YesNo } from './ui'

interface Draft {
  type?: ProcedureType
  label?: string
  firstOperator?: boolean
  success?: boolean
  firstTry?: boolean
  attempts?: 1 | 2 | 3 | 4
  time?: AttemptTime
  help?: HelpLevel
  hadIncident?: boolean
  incidents: string[]
  incidentOther?: string
  incidentsDone?: boolean
  notes?: string
}

interface Q {
  key: string
  visible: (d: Draft) => boolean
  answered: (d: Draft) => boolean
  title: string
  hint?: string
  summary: (d: Draft) => string
  render: (d: Draft, set: (p: Partial<Draft>) => void) => ReactNode
}

function fromRecord(p?: ProcedureRecord): Draft {
  if (!p) return { incidents: [] }
  return {
    type: p.type,
    label: p.label,
    firstOperator: p.firstOperator,
    success: p.success,
    firstTry: p.success ? p.attempts === 1 : undefined,
    attempts: p.attempts,
    time: p.time,
    help: p.help,
    hadIncident: p.incidents.length > 0,
    incidents: p.incidents,
    incidentOther: p.incidentOther,
    incidentsDone: true,
    notes: p.notes,
  }
}

function toRecord(d: Draft, id: string): ProcedureRecord {
  return {
    id,
    type: d.type!,
    label: procDef(d.type!).needsLabel ? d.label?.trim() || undefined : undefined,
    firstOperator: d.firstOperator!,
    success: d.success!,
    attempts: d.success && d.firstTry ? 1 : d.attempts!,
    time: d.time!,
    help: d.help!,
    incidents: d.hadIncident ? d.incidents : [],
    incidentOther: d.hadIncident && d.incidents.includes(INCIDENT_OTHER) ? d.incidentOther?.trim() || undefined : undefined,
    notes: d.notes?.trim() || undefined,
  }
}

export function ProcedureFlow({
  initial,
  perspective,
  usedTypes = [],
  onDone,
  onCancel,
}: {
  initial?: ProcedureRecord
  perspective: Role
  /** Un procedimiento no se puede repetir dentro del mismo caso */
  usedTypes?: ProcedureType[]
  onDone: (p: ProcedureRecord) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<Draft>(() => fromRecord(initial))
  const [editing, setEditing] = useState<string | null>(null)
  const curRef = useRef<HTMLDivElement>(null)
  const you = perspective === 'residente'
  const t = (res: string, att: string) => (you ? res : att)
  const blocked = (id: ProcedureType) => id !== 'otro' && id !== initial?.type && usedTypes.includes(id)

  const set = (p: Partial<Draft>) => {
    setD((x) => ({ ...x, ...p }))
    setEditing(null)
  }

  const questions: Q[] = [
    {
      key: 'type',
      title: '¿Qué procedimiento?',
      visible: () => true,
      answered: (d) => !!d.type && (!procDef(d.type).needsLabel || !!d.label?.trim()),
      summary: (d) => (procDef(d.type!).needsLabel && d.label ? `${procDef(d.type!).short}: ${d.label}` : procDef(d.type!).short),
      render: (d, set) => (
        <>
          <div className="grid2">
            {PROCEDURES.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={blocked(p.id)}
                className={`choice${d.type === p.id ? ' on' : ''}`}
                style={{ padding: '12px', fontSize: 14, opacity: blocked(p.id) ? 0.35 : 1 }}
                onClick={() => (p.needsLabel ? setD((x) => ({ ...x, type: p.id, label: '' })) : set({ type: p.id, label: undefined }))}
              >
                {p.label}
              </button>
            ))}
          </div>
          {usedTypes.length > 0 && <div className="tiny muted mt8">Los que ya registraste en este caso aparecen desactivados.</div>}
          {d.type && procDef(d.type).needsLabel && (
            <div className="row mt12">
              <input
                className="input"
                placeholder={d.type === 'periferico' ? '¿Cuál bloqueo?' : '¿Cuál procedimiento?'}
                autoFocus
                value={d.label ?? ''}
                onChange={(e) => setD((x) => ({ ...x, label: e.target.value }))}
              />
              <button className="btn primary" disabled={!d.label?.trim()} onClick={() => setEditing(null)}>
                OK
              </button>
            </div>
          )}
        </>
      ),
    },
    {
      key: 'firstOperator',
      title: t('¿Fuiste primer operador?', '¿Fue primer operador?'),
      visible: () => true,
      answered: (d) => d.firstOperator !== undefined,
      summary: (d) => (d.firstOperator ? 'Sí' : 'Participación parcial'),
      render: (d, set) => <YesNo neutral value={d.firstOperator} onPick={(v) => set({ firstOperator: v })} no="Participé parcialmente" />,
    },
    {
      key: 'success',
      title: t('¿Lo lograste?', '¿Lo logró?'),
      visible: () => true,
      answered: (d) => d.success !== undefined,
      summary: (d) => (d.success ? 'Sí' : 'No'),
      render: (d, set) => <YesNo value={d.success} onPick={(v) => set({ success: v, firstTry: undefined, attempts: undefined })} />,
    },
    {
      key: 'firstTry',
      title: '¿Al primer intento?',
      visible: (d) => d.success === true,
      answered: (d) => d.firstTry !== undefined,
      summary: (d) => (d.firstTry ? 'Sí' : 'No'),
      render: (d, set) => <YesNo value={d.firstTry} onPick={(v) => set({ firstTry: v, attempts: v ? 1 : undefined })} />,
    },
    {
      key: 'attempts',
      title: '¿Entonces en cuál intento?',
      visible: (d) => d.success === true && d.firstTry === false,
      answered: (d) => !!d.attempts && d.attempts > 1,
      summary: (d) => (d.attempts === 4 ? '4º o más' : `${d.attempts}º`),
      render: (d, set) => (
        <div className="big-choices" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {([2, 3, 4] as const).map((n) => (
            <button key={n} className={`big-choice${d.attempts === n ? ' on' : ''}`} onClick={() => set({ attempts: n })}>
              {n === 4 ? '4º+' : `${n}º`}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'attemptsFail',
      title: '¿Cuántos intentos se hicieron?',
      visible: (d) => d.success === false,
      answered: (d) => !!d.attempts,
      summary: (d) => (d.attempts === 4 ? '4 o más' : String(d.attempts)),
      render: (d, set) => (
        <div className="big-choices" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {([1, 2, 3, 4] as const).map((n) => (
            <button key={n} className={`big-choice${d.attempts === n ? ' on' : ''}`} onClick={() => set({ attempts: n })}>
              {n === 4 ? '4+' : n}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'time',
      title: '¿Cuánto tiempo, aproximadamente?',
      visible: () => true,
      answered: (d) => !!d.time,
      summary: (d) => ATTEMPT_TIMES.find((x) => x.id === d.time)!.label,
      render: (d, set) => (
        <div className="big-choices" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {ATTEMPT_TIMES.map((x) => (
            <button key={x.id} className={`big-choice${d.time === x.id ? ' on' : ''}`} style={{ fontSize: 16 }} onClick={() => set({ time: x.id })}>
              {x.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'help',
      title: t('¿Qué ayuda necesitaste?', '¿Qué ayuda requirió?'),
      visible: () => true,
      answered: (d) => d.help !== undefined,
      summary: (d) => HELP[d.help!].label,
      render: (d, set) => <ChoiceList value={d.help} onPick={(v) => set({ help: v })} options={HELP.map((h) => ({ v: h.id, title: you ? h.resident : h.label }))} />,
    },
    {
      key: 'hadIncident',
      title: '¿Hubo algún incidente o complicación?',
      visible: () => true,
      answered: (d) => d.hadIncident !== undefined,
      summary: (d) => (d.hadIncident ? 'Sí' : 'No'),
      render: (d, set) => <YesNo neutral value={d.hadIncident} onPick={(v) => set({ hadIncident: v, incidentsDone: !v })} />,
    },
    {
      key: 'incidents',
      title: '¿Cuál o cuáles?',
      visible: (d) => d.hadIncident === true,
      answered: (d) => !!d.incidentsDone && d.incidents.length > 0 && (!d.incidents.includes(INCIDENT_OTHER) || !!d.incidentOther?.trim()),
      summary: (d) => d.incidents.map((i) => (i === INCIDENT_OTHER && d.incidentOther ? d.incidentOther : i)).join(', '),
      render: (d) => (
        <>
          <MultiChips options={INCIDENTS} value={d.incidents} onChange={(v) => setD((x) => ({ ...x, incidents: v }))} />
          {d.incidents.includes(INCIDENT_OTHER) && (
            <input className="input mt12" placeholder="¿Cuál incidente?" value={d.incidentOther ?? ''} onChange={(e) => setD((x) => ({ ...x, incidentOther: e.target.value }))} />
          )}
          <button
            className="btn primary block mt12"
            disabled={!d.incidents.length || (d.incidents.includes(INCIDENT_OTHER) && !d.incidentOther?.trim())}
            onClick={() => set({ incidentsDone: true })}
          >
            Continuar
          </button>
        </>
      ),
    },
  ]

  const visible = questions.filter((q) => q.visible(d))
  const current = editing ?? visible.find((q) => !q.answered(d))?.key ?? null

  useEffect(() => {
    curRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [current])

  const done = current === null
  const preview = done ? toRecord(d, initial?.id ?? 'x') : null
  const fail = preview ? isCusumFailure(preview, procDef(preview.type)) : false

  return (
    <div>
      {visible.map((q) => {
        if (q.key === current)
          return (
            <div key={q.key} ref={curRef} className="question">
              <div className="q-title">{q.title}</div>
              {q.hint && <div className="q-hint">{q.hint}</div>}
              {q.render(d, set)}
            </div>
          )
        if (!q.answered(d)) return null
        return (
          <button key={q.key} className="answered" onClick={() => setEditing(q.key)}>
            <span className="q">{q.title}</span>
            <span className="a">
              {q.summary(d)} <Pencil size={12} className="muted" />
            </span>
          </button>
        )
      })}

      {done && preview && (
        <div className="question" ref={curRef}>
          <div className="card flat mt12" style={{ background: fail ? 'var(--warn-soft)' : 'var(--good-soft)', border: 0 }}>
            <div className="small bold" style={{ color: fail ? 'var(--warn-ink)' : 'var(--good-ink)' }}>
              Para la curva CUSUM esto cuenta como {fail ? 'falla' : 'éxito'}
            </div>
            <div className="tiny ink2" style={{ marginTop: 4 }}>
              Se calcula solo: éxito = se logró, ≤ 2 intentos y sin relevo.
            </div>
          </div>
          <div className="field-label">Observaciones (opcional)</div>
          <textarea className="textarea" placeholder="Ej. Cormack III, se usó bougie…" value={d.notes ?? ''} onChange={(e) => setD((x) => ({ ...x, notes: e.target.value }))} />
          <div className="row mt16">
            <button className="btn" onClick={onCancel}>
              Cancelar
            </button>
            <button className="btn primary grow" onClick={() => onDone(toRecord(d, initial?.id ?? newId('p')))}>
              Guardar procedimiento
            </button>
          </div>
        </div>
      )}
      {!done && (
        <button className="btn ghost block mt16" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </div>
  )
}
