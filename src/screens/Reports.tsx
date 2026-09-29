import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react'
import { useStore } from '../store'
import type { Grade, ProcedureType } from '../types'
import { RESIDENTS, USERS, userById } from '../data/users'
import { ANTS_DOMAINS, OSCORE_TARGET, PROTOCOL_PROCEDURES, SHIFTS, SUPERVISION, procDef } from '../data/catalog'
import { antsDomains, attemptsOf, avg, caseSupervision, casesOf, chartCases, counts, outcomeOf } from '../lib/stats'
import { SMALL_N, rateText } from '../lib/success'
import { exportAggregate, exportResearch } from '../lib/export'
import { fmtDuration, monthLong } from '../lib/dates'
import { Kpi, TopBar } from '../components/ui'
import { DomainBars, ORDINAL_BLUE, RateBars, StackedBar, blocks } from '../components/charts'

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
  // Tasa de éxito = éxitos / intentos validados (no es la curva CUSUM)
  const procRows = PROTOCOL_PROCEDURES.map((def) => {
    const list = inP.flatMap((c) => c.procedures.filter((p) => p.type === def.id && counts(p, c)).map((p) => ({ p, c })))
    const ok = list.filter(({ p, c }) => outcomeOf(p, c).status === 'exito').length
    return { def, n: list.length, ok }
  })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
  const noAttending = inP.filter((c) => !c.attendingId).length
  // ¿Cambia el desempeño en complementaria (vespertino/guardia: más cansancio, menos vigilancia)?
  const byShift = SHIFTS.map((sh) => {
    const cs = inP.filter((c) => c.shift === sh.id)
    const procs = cs.flatMap((c) => c.procedures.filter((p) => counts(p, c)).map((p) => ({ p, c })))
    return {
      sh,
      n: cs.length,
      oscore: avg(chartCases(cs).map((c) => caseSupervision(c.evaluation))),
      procs: procs.length,
      ok: procs.filter(({ p, c }) => outcomeOf(p, c).status === 'exito').length,
      critical: cs.filter((c) => c.criticalEvent).length,
    }
  })

  // Curva de aprendizaje por bloques de intentos: todos los residentes del hospital (la sede), según
  // el número de intento de cada uno. Descriptiva; no es la curva CUSUM.
  const siteRows = useMemo(
    () => blocks(USERS.filter((u) => u.role === 'residente').map((u) => attemptsOf(casesOf(cases, u.id), siteProc).map((a) => a.fail))),
    [cases, siteProc],
  )
  const pendingValidation = inP.filter((c) => c.status === 'pendiente').length
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
          <Kpi label="Casos registrados" value={inP.length} hint={`${ev.length} validados · ${pendingValidation} por validar`} />
          <Kpi label="O-SCORE medio" value={sup?.toFixed(2) ?? '—'} hint={`Referencia provisional ≥ ${lo}`} />
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
                <th className="r">ANTS*</th>
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
                    <td className="r">{s !== null && s < lo ? <span className="badge warn">Revisar</span> : <span className="badge good">En rango</span>}</td>
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
          <div className="tiny muted mt8">
            Estado = O-SCORE promedio contra la referencia provisional del grado; "Revisar" significa llevarlo a la sesión trimestral, no una calificación. *ANTS es solo
            formativo: no cuenta para el estado.
          </div>
        </div>

        <div className="h2">Distribución del O-SCORE</div>
        <div className="card">
          <StackedBar parts={dist} />
          <div className="tiny muted mt8">Cada procedimiento validado cuenta como un dato.</div>
        </div>

        <div className="h2">ANTS del grado</div>
        <div className="card">
          <DomainBars rows={ANTS_DOMAINS.map((d) => ({ label: d.label, value: dom[d.id] }))} max={4} />
          <div className="tiny muted mt8">Referencia formativa, sin umbral: no cuenta para el estado ni dispara alertas.</div>
        </div>

        <div className="h2">Tasa de éxito por procedimiento</div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Procedimiento</th>
                <th className="r">n</th>
                <th className="r">Tasa de éxito (IC95%)</th>
              </tr>
            </thead>
            <tbody>
              {procRows.map((r) => (
                <tr key={r.def.id}>
                  <td>
                    {procDef(r.def.id).short}
                    {r.def.estado === 'calibracion' && <div className="tiny muted">En calibración</div>}
                  </td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">
                    {rateText(r.ok, r.n)}
                    {r.n > 0 && r.n < SMALL_N && ' ⚠'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted mt8">
            n = intentos validados por el adscrito (como primer operador). Tasa de éxito = éxitos / n, con los criterios de cada procedimiento. ⚠ n menor de {SMALL_N}: porcentaje
            poco estable.
          </div>
        </div>

        <div className="h2">Por jornada</div>
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Jornada</th>
                <th className="r">Casos</th>
                <th className="r">O-SCORE</th>
                <th className="r">Tasa de éxito</th>
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
                  <td className="r num">
                    {rateText(r.ok, r.procs)}
                    <div className="tiny muted">n={r.procs}</div>
                  </td>
                  <td className="r num">{r.critical}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted mt8">La jornada la marca el residente al registrar el caso. Sirve para ver si en complementaria (vespertino o guardia) cambia el desempeño. n = intentos validados.</div>
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

        <div className="h2">Curva de aprendizaje por bloques de intentos · toda la sede</div>
        <div className="card">
          <select className="input" value={siteProc} onChange={(e) => setSiteProc(e.target.value as ProcedureType)} aria-label="Procedimiento">
            {PROTOCOL_PROCEDURES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="mt12">
            <RateBars rows={siteRows} unit="intentos validados de todos los residentes en ese bloque" />
          </div>
          <div className="tiny muted mt8" style={{ lineHeight: 1.5 }}>
            Cada residente aporta sus intentos según su número de intento (1º–5º, 6º–10º…), con toda la residencia y sin importar el periodo elegido arriba. Es una curva
            descriptiva, no la curva CUSUM: con ella se estimarán los parámetros locales en el ciclo 2.
          </div>
        </div>

        <div className="grid2 mt12">
          <Kpi label="Ameritan revisión" value={reviews} hint="marcados por el adscrito" />
          <Kpi label="Riesgo al paciente" value={risks} hint="atribuible al residente" />
        </div>
        <div className="h2">Base de investigación</div>
        <div className="card">
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm grow" onClick={() => exportResearch(cases)}>
              <Download size={15} /> Datos seudonimizados
            </button>
            <button className="btn sm grow" onClick={() => exportAggregate(cases)}>
              <Download size={15} /> Agregado por grado
            </button>
          </div>
          <div className="tiny muted mt8">
            CSV con un renglón por procedimiento: identificadores seudónimos, fecha a nivel de mes y sin nombres, códigos ni texto libre. El agregado trae n, tasa de éxito e
            IC95% por grado y procedimiento.
          </div>
        </div>

        <p className="tiny muted mt16">
          Reporte generado a partir de {ev.length} evaluaciones de {new Set(ev.map((c) => c.evaluation.attendingId)).size} adscritos (
          {[...new Set(ev.map((c) => c.evaluation.attendingId))].map((id) => userById(id).name.split(' ')[0]).join(', ')}).
        </p>
      </div>
    </>
  )
}
