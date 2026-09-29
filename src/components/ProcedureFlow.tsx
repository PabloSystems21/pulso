// Flujo conversacional: una pregunta a la vez, las respuestas quedan como "migajas" editables.
// "¿Lo lograste? Sí → ¿Al primer intento? No → ¿En cuál? 2º"
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import type { AttemptTime, HelpLevel, ProcedureRecord, ProcedureType, Role } from '../types'
import { ATTEMPT_TIMES, HELP, INCIDENTS, INCIDENT_OTHER, LOGRO, PROCEDURES, criteriaText, procDef } from '../data/catalog'
import { criteriaResult } from '../lib/success'
import { newId } from '../store'
import { ChoiceList, MultiChips, YesNo } from './ui'

/** Qué cuenta como intento (definición de enseñanza) */
const ATTEMPT_HINT =
  'Un intento = volver a iniciar: volver a puncionar o volver a introducir el laringoscopio o el dispositivo. Reacomodar la aguja, la posición o la dirección, o cambiar de técnica, no cuenta como intento nuevo.'

interface Draft {
  type?: ProcedureType
  label?: string
  firstOperator?: boolean
  success?: boolean
  firstTry?: boolean
  attempts?: ProcedureRecord['attempts']
  time?: AttemptTime
  help?: HelpLevel
  /** Criterio de logro del procedimiento (true = se cumplió) */
  logro?: boolean
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
    logro: p.logro,
    hadIncident: p.incidents.length > 0,
    incidents: p.incidents,
    incidentOther: p.incidentOther,
    incidentsDone: true,
    notes: p.notes,
  }
}

function toRecord(d: Draft, id: string): ProcedureRecord {
  const def = procDef(d.type!)
  return {
    id,
    type: d.type!,
    label: def.pideNombre ? d.label?.trim() || undefined : undefined,
    firstOperator: d.firstOperator!,
    success: d.success!,
    attempts: d.success && d.firstTry ? 1 : d.attempts!,
    time: d.time!,
    help: d.help!,
    logro: def.criterios.logro ? d.logro : undefined,
    incidents: d.hadIncident ? d.incidents : [],
    incidentOther: d.hadIncident && d.incidents.includes(INCIDENT_OTHER) ? d.incidentOther?.trim() || undefined : undefined,
    notes: d.notes?.trim() || undefined,
  }
}

export function ProcedureFlow({
  initial,
  perspective,
  noAttending,
  usedTypes = [],
  onDone,
  onCancel,
}: {
  initial?: ProcedureRecord
  perspective: Role
  /** Sin adscrito el procedimiento no cuenta para curvas ni tasas */
  noAttending?: boolean
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
  const logroKey = d.type ? procDef(d.type).criterios.logro : null
  const logroDef = logroKey ? LOGRO[logroKey] : null

  const set = (p: Partial<Draft>) => {
    setD((x) => ({ ...x, ...p }))
    setEditing(null)
  }

  const questions: Q[] = [
    {
      key: 'type',
      title: '¿Qué procedimiento?',
      visible: () => true,
      answered: (d) => !!d.type && (!procDef(d.type).pideNombre || !!d.label?.trim()),
      summary: (d) => (procDef(d.type!).pideNombre && d.label ? `${procDef(d.type!).short}: ${d.label}` : procDef(d.type!).short),
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
                onClick={() => (p.pideNombre ? setD((x) => ({ ...x, type: p.id, label: '', logro: undefined })) : set({ type: p.id, label: undefined, logro: undefined }))}
              >
                {p.label}
              </button>
            ))}
          </div>
          {usedTypes.length > 0 && <div className="tiny muted mt8">Los que ya registraste en este caso aparecen desactivados.</div>}
          {d.type && procDef(d.type).pideNombre && (
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
      hint: ATTEMPT_HINT,
      visible: (d) => d.success === true,
      answered: (d) => d.firstTry !== undefined,
      summary: (d) => (d.firstTry ? 'Sí' : 'No'),
      render: (d, set) => <YesNo value={d.firstTry} onPick={(v) => set({ firstTry: v, attempts: v ? 1 : undefined })} />,
    },
    {
      key: 'attempts',
      title: '¿Entonces en cuál intento?',
      hint: ATTEMPT_HINT,
      visible: (d) => d.success === true && d.firstTry === false,
      answered: (d) => !!d.attempts && d.attempts > 1,
      summary: (d) => (d.attempts === 6 ? '6º o más' : `${d.attempts}º`),
      render: (d, set) => (
        <div className="big-choices" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {([2, 3, 4, 5, 6] as const).map((n) => (
            <button key={n} className={`big-choice${d.attempts === n ? ' on' : ''}`} style={{ fontSize: 17 }} onClick={() => set({ attempts: n })}>
              {n === 6 ? '6º+' : `${n}º`}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'attemptsFail',
      title: '¿Cuántos intentos se hicieron?',
      hint: ATTEMPT_HINT,
      visible: (d) => d.success === false,
      answered: (d) => !!d.attempts,
      summary: (d) => (d.attempts === 6 ? '6 o más' : String(d.attempts)),
      render: (d, set) => (
        <div className="big-choices" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {([1, 2, 3, 4, 5, 6] as const).map((n) => (
            <button key={n} className={`big-choice${d.attempts === n ? ' on' : ''}`} style={{ fontSize: 17 }} onClick={() => set({ attempts: n })}>
              {n === 6 ? '6+' : n}
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
      // Criterio de logro: desaturación, bloqueo funcional, transducción adecuada o retorno venoso
      key: 'logro',
      title: logroDef?.question ?? '',
      hint: logroDef?.hint,
      visible: (d) => !!d.type && !!procDef(d.type).criterios.logro,
      answered: (d) => d.logro !== undefined,
      summary: (d) => (logroDef?.inverted ? (d.logro ? 'No' : 'Sí') : d.logro ? 'Sí' : 'No'),
      render: (d, set) => {
        const inv = !!logroDef?.inverted
        return <YesNo neutral value={d.logro === undefined ? undefined : inv ? !d.logro : d.logro} onPick={(v) => set({ logro: inv ? !v : v })} />
      },
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
  const result = preview ? criteriaResult(preview) : null
  const counts = !!preview?.firstOperator && !noAttending
  const def = preview ? procDef(preview.type) : null

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

      {done && preview && result && def && (
        <div className="question" ref={curRef}>
          {counts ? (
            <div className="card flat mt12" style={{ background: result.success ? 'var(--good-soft)' : 'var(--warn-soft)', border: 0 }}>
              <div className="small bold" style={{ color: result.success ? 'var(--good-ink)' : 'var(--warn-ink)' }}>
                Según los criterios, esto sería {result.success ? 'éxito' : 'fallo'} (provisional)
              </div>
              <div className="tiny ink2" style={{ marginTop: 4 }}>
                Se confirma cuando tu adscrito lo valide.{result.reasons.length > 0 && ` No cumplió: ${result.reasons.join(' · ')}.`}
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Éxito en {def.short.toLowerCase()}: {criteriaText(def).join(' · ')}.{def.criteriosProvisionales && ' Criterios provisionales.'}
              </div>
            </div>
          ) : (
            <div className="card flat mt12" style={{ border: 0, background: '#eef2f3' }}>
              <div className="small bold">Este procedimiento no cuenta para la curva ni la tasa de éxito</div>
              <div className="tiny ink2" style={{ marginTop: 4 }}>
                {noAttending ? 'No hubo un adscrito que lo supervisara y validara.' : 'Solo cuenta cuando fuiste primer operador.'}
              </div>
            </div>
          )}
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
