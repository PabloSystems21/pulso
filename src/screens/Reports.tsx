import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useStore } from '../store'
import type { Grade, ProcedureType } from '../types'
import { RESIDENTS, USERS, userById } from '../data/users'
import { ANTS_DOMAINS, ANTS_TARGET, OSCORE_TARGET, PROCEDURES, SHIFTS, SUPERVISION, procDef } from '../data/catalog'
import { antsDomains, avg, caseSupervision, casesOf, chartCases, countsForCusum, cusumItems, failsFor } from '../lib/stats'
import { isCusumFailure } from '../lib/cusum'
import { fmtDuration, monthLong } from '../lib/dates'
import { Kpi, TopBar } from '../components/ui'
import { DomainBars, ORDINAL_BLUE, StackedBar } from '../components/charts'

type Period = 'mes' | 'trimestre'

export default function Reports() {
  const { cases } = useStore()
  const [grade, setGrade] = useState<Grade>('R1')
  const [period, setPeriod] = useState<Period>('mes')
  const [offset, setOffset] = useState(0)
  const [siteProc, setSiteProc] = useState<ProcedureType>('laringoscopia')

  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const months = period === 'mes' ? 1 : 3
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1)
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const label =
    period === 'mes'
      ? `${monthLong(end.getMonth())} ${end.getFullYear()}`
      : `${monthLong(start.getMonth()).slice(0, 3)} – ${monthLong(end.getMonth()).slice(0, 3)} ${end.getFullYear()}`

  const keyStr = keys.join()
  const data = useMemo(() => {
    const inP = cases.filter((c) => c.grade === grade && keys.includes(c.date.slice(0, 7)))
    const ev = chartCases(inP)
    const residents = RESIDENTS.filter((r) => inP.some((c) => c.residentId === r.id))
    return { inP, ev, residents }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, grade, keyStr])

  const { inP, ev, residents } = data
  const sup = avg(ev.map((c) => caseSupervision(c.evaluation)))
  const lo = OSCORE_TARGET[grade]
  const durations = avg(ev.map((c) => c.evaluation.durationSec))
  const dom = antsDomains(ev.map((c) => c.evaluation))
  const dist = [1, 2, 3, 4, 5].map((v) => ({
    label: SUPERVISION[v - 1].short,
    value: ev.flatMap((c) => Object.values(c.evaluation.supervision)).filter((x) => x === v).length,
    color: ORDINAL_BLUE[v - 1],
  }))
  const procRows = PROCEDURES.filter((p) => p.id !== 'otro')
    .map((def) => {
      const list = inP.flatMap((c) => c.procedures.filter((p) => p.type === def.id && countsForCusum(p, c)).map((p) => ({ p, c })))
      const ok = list.filter(({ p, c }) => !failsFor(p, c)).length
      return { def, n: list.length, rate: list.length ? ok / list.length : 0 }
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
  const noAttending = inP.filter((c) => !c.attendingId).length
  // ¿Cambia el desempeño en complementaria (vespertino/guardia: más cansancio, menos vigilancia)?
  const byShift = SHIFTS.map((sh) => {
    const cs = inP.filter((c) => c.shift === sh.id)
    const procs = cs.flatMap((c) => c.procedures.filter((p) => countsForCusum(p, c)).map((p) => ({ p, c })))
    return {
      sh,
      n: cs.length,
      oscore: avg(chartCases(cs).map((c) => caseSupervision(c.evaluation))),
      procs: procs.length,
      rate: procs.length ? procs.filter(({ p, c }) => !failsFor(p, c)).length / procs.length : null,
      critical: cs.filter((c) => c.criticalEvent).length,
    }
  })

  // Curva de la sede: todos los residentes del hospital, por número de intento acumulado.
  // Se usa la definición estricta de éxito (la de R2/R3) para que sea comparable entre grados.
  const site = useMemo(() => {
    const def = procDef(siteProc)
    const buckets: { ok: number; n: number }[] = []
    USERS.filter((u) => u.role === 'residente').forEach((u) => {
      cusumItems(casesOf(cases, u.id), siteProc).forEach((it, k) => {
        const b = Math.min(Math.floor(k / 5), 9)
        buckets[b] ??= { ok: 0, n: 0 }
        buckets[b].n++
        if (!isCusumFailure(it.proc, def, 'R2', it.oscore)) buckets[b].ok++
      })
    })
    return buckets.map((b, i) => ({ label: i === 9 ? '46+' : `${i * 5 + 1}–${i * 5 + 5}`, ...b })).filter((b) => b && b.n)
  }, [cases, siteProc])
  const risks = ev.filter((c) => c.evaluation.patientRisk).length
  const reviews = ev.filter((c) => c.evaluation.needsProfessorReview).length
  const themes = Object.entries(
    ev.reduce<Record<string, number>>((acc, c) => {
      acc[c.evaluation.improve] = (acc[c.evaluation.improve] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <>
      <TopBar
        title="Reportes"
        sub="Insumo para la sesión trimestral"
        right={
          <button className="icon-btn" aria-label="Imprimir" onClick={() => window.print()}>
            <Printer size={18} />
          </button>
        }
      />
      <div className="screen">
        <div className="segmented-tabs">
          {(['R1', 'R2', 'R3'] as const).map((g) => (
            <button key={g} className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="segmented-tabs mt12">
          {(['mes', 'trimestre'] as const).map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
              {p === 'mes' ? 'Mensual' : 'Trimestral'}
            </button>
          ))}
        </div>
        <div className="row between mt12 card tight">
          <button className="icon-btn" style={{ boxShadow: 'none', background: '#eef2f3' }} onClick={() => setOffset(offset + months)} aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="bold" style={{ textTransform: 'capitalize' }}>
            {label}
          </span>
          <button
            className="icon-btn"
            style={{ boxShadow: 'none', background: '#eef2f3' }}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - months))}
            aria-label="Siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid2 mt12">
          <Kpi label="Casos registrados" value={inP.length} hint={`${ev.length} ya evaluados`} />
          <Kpi label="O-SCORE medio" value={sup?.toFixed(2) ?? '—'} hint={`Esperado ≥ ${lo.toFixed(1)}`} />
          <Kpi label="Tiempo por evaluación" value={durations ? fmtDuration(durations) : '—'} hint="min promedio" />
          <Kpi label="Casos sin adscrito" value={noAttending} hint="requieren revisión" />
        </div>

        <div className="h2">Residentes {grade}</div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Residente</th>
                <th className="r">Casos</th>
                <th className="r">O-SCORE</th>
                <th className="r">ANTS</th>
                <th className="r">Estado</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => {
                const rev = ev.filter((c) => c.residentId === r.id)
                const s = avg(rev.map((c) => caseSupervision(c.evaluation)))
                const a = avg(Object.values(antsDomains(rev.map((c) => c.evaluation))))
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/a/residente/${r.id}`} className="bold">
                        {r.name}
                      </Link>
                    </td>
                    <td className="r num">{inP.filter((c) => c.residentId === r.id).length}</td>
                    <td className="r num">{s?.toFixed(1) ?? '—'}</td>
                    <td className="r num">{a?.toFixed(1) ?? '—'}</td>
                    <td className="r">{s !== null && s < lo ? <span className="badge warn">Bajo</span> : <span className="badge good">En rango</span>}</td>
                  </tr>
                )
              })}
              {!residents.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    Sin registros en el periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h2">Distribución del O-SCORE</div>
        <div className="card">
          <StackedBar parts={dist} />
          <div className="tiny muted mt8">Cada procedimiento evaluado cuenta como un dato.</div>
        </div>

        <div className="h2">ANTS del grado</div>
        <div className="card">
          <DomainBars rows={ANTS_DOMAINS.map((d) => ({ label: d.label, value: dom[d.id] }))} max={4} target={ANTS_TARGET[grade]} />
        </div>

        <div className="h2">Procedimientos del periodo</div>
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Procedimiento</th>
                <th className="r">N</th>
                <th className="r">Éxito CUSUM</th>
              </tr>
            </thead>
            <tbody>
              {procRows.map((r) => (
                <tr key={r.def.id}>
                  <td>{procDef(r.def.id).short}</td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">{Math.round(r.rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h2">Por jornada</div>
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Jornada</th>
                <th className="r">Casos</th>
                <th className="r">O-SCORE</th>
                <th className="r">Éxito CUSUM</th>
                <th className="r">Ev. crít.</th>
              </tr>
            </thead>
            <tbody>
              {byShift.map((r) => (
                <tr key={r.sh.id}>
                  <td>
                    <div className="bold">{r.sh.label}</div>
                    <div className="tiny muted">{r.sh.hint}</div>
                  </td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">{r.oscore?.toFixed(1) ?? '—'}</td>
                  <td className="r num">{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</td>
                  <td className="r num">{r.critical}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted mt8">La jornada la marca el residente al registrar el caso. Sirve para ver si en complementaria (vespertino o guardia) cambia la curva.</div>
        </div>

        <div className="h2">Prioridades de mejora más frecuentes</div>
        <div className="list">
          {themes.map(([t, n]) => (
            <div key={t} className="list-row">
              <span className="grow small">{t}</span>
              <span className="badge num">{n}</span>
            </div>
          ))}
        </div>

        <div className="h2">Curva de la sede · todo el hospital</div>
        <div className="card">
          <select className="input" value={siteProc} onChange={(e) => setSiteProc(e.target.value as ProcedureType)} aria-label="Procedimiento">
            {PROCEDURES.filter((p) => p.id !== 'otro').map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="stack mt12">
            {site.map((b) => (
              <div key={b.label}>
                <div className="row between small">
                  <span className="ink2" style={{ fontWeight: 600 }}>
                    Intentos {b.label}
                  </span>
                  <span className="num">
                    <b>{Math.round((b.ok / b.n) * 100)}%</b> <span className="tiny muted">n={b.n}</span>
                  </span>
                </div>
                <div className="bar-track" style={{ marginTop: 5 }}>
                  <div className="bar-fill" style={{ width: `${(b.ok / b.n) * 100}%` }} />
                </div>
              </div>
            ))}
            {!site.length && <div className="small muted">Sin registros de este procedimiento.</div>}
          </div>
          <div className="tiny muted mt12" style={{ lineHeight: 1.5 }}>
            % de éxito según el número de intento de cada residente (1º–5º, 6º–10º…), con toda la residencia. Es descriptiva: con ella se van a definir los cortes propios de
            la CUSUM (a partir del 2º año). Usa la definición estricta de éxito: ≤ 2 intentos, ≤ 10 min, sin ayuda o solo verbal y sin que el adscrito tome el control.
          </div>
        </div>

        <div className="grid2 mt12">
          <Kpi label="Ameritan revisión" value={reviews} hint="marcados por el adscrito" />
          <Kpi label="Riesgo al paciente" value={risks} hint="atribuible al residente" />
        </div>
        <p className="tiny muted mt16">
          Reporte generado a partir de {ev.length} evaluaciones de {new Set(ev.map((c) => c.evaluation.attendingId)).size} adscritos (
          {[...new Set(ev.map((c) => c.evaluation.attendingId))].map((id) => userById(id).name.split(' ')[0]).join(', ')}).
        </p>
      </div>
    </>
  )
}
