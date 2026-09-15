import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import { useStore } from '../store'
import type { Grade } from '../types'
import { RESIDENTS, userById } from '../data/users'
import { ANTS_DOMAINS, ANTS_TARGET, PROCEDURES, SUPERVISION, expectedBand, procDef } from '../data/catalog'
import { antsDomains, avg, evaluatedOf, monthsIntoGradeAt } from '../lib/stats'
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

  const data = useMemo(() => {
    const inP = cases.filter((c) => c.grade === grade && keys.includes(c.date.slice(0, 7)))
    const ev = evaluatedOf(inP)
    const residents = RESIDENTS.filter((r) => inP.some((c) => c.residentId === r.id))
    return { inP, ev, residents }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, grade, keys.join()])

  const { inP, ev, residents } = data
  const sup = avg(ev.map((c) => c.evaluation.supervision))
  const midDate = `${keys[keys.length - 1]}-15`
  const [lo] = expectedBand(grade, monthsIntoGradeAt(midDate))
  const progression = ev.length ? ev.filter((c) => c.evaluation.countsForProgression).length / ev.length : 0
  const durations = avg(ev.map((c) => c.evaluation.durationSec))
  const dom = antsDomains(ev.map((c) => c.evaluation))
  const dist = [1, 2, 3, 4, 5].map((v) => ({ label: SUPERVISION[v - 1].short, value: ev.filter((c) => c.evaluation.supervision === v).length, color: ORDINAL_BLUE[v - 1] }))
  const procRows = PROCEDURES.filter((p) => p.id !== 'otro')
    .map((def) => {
      const list = inP.flatMap((c) => c.procedures.filter((p) => p.type === def.id && p.firstOperator))
      const ok = list.filter((p) => !isCusumFailure(p, procDef(p.type))).length
      return { def, n: list.length, rate: list.length ? ok / list.length : 0 }
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
  const followUps = ev.filter((c) => c.evaluation.followUp !== 'no').length
  const risks = ev.filter((c) => c.evaluation.patientRisk !== 'no').length
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
        <div className="row mt12">
          <div className="segmented-tabs grow">
            {(['mes', 'trimestre'] as const).map((p) => (
              <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
                {p === 'mes' ? 'Mensual' : 'Trimestral'}
              </button>
            ))}
          </div>
        </div>
        <div className="row between mt12 card tight">
          <button className="icon-btn" style={{ boxShadow: 'none', background: '#eef2f3' }} onClick={() => setOffset(offset + months)} aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="bold" style={{ textTransform: 'capitalize' }}>
            {label}
          </span>
          <button className="icon-btn" style={{ boxShadow: 'none', background: '#eef2f3' }} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - months))} aria-label="Siguiente">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid2 mt12">
          <Kpi label="Evaluaciones" value={ev.length} hint={`${inP.length} casos registrados`} />
          <Kpi label="Supervisión media" value={sup?.toFixed(2) ?? '—'} hint={`Esperado ≥ ${lo.toFixed(1)}`} />
          <Kpi label="Cuentan p/ progresión" value={`${Math.round(progression * 100)}%`} />
          <Kpi label="Tiempo por evaluación" value={durations ? fmtDuration(durations) : '—'} hint="min promedio" />
        </div>

        <div className="h2">Residentes {grade}</div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Residente</th>
                <th className="r">Casos</th>
                <th className="r">Superv.</th>
                <th className="r">ANTS</th>
                <th className="r">Estado</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => {
                const rev = ev.filter((c) => c.residentId === r.id)
                const s = avg(rev.map((c) => c.evaluation.supervision))
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

        <div className="h2">Distribución de supervisión</div>
        <div className="card">
          <StackedBar parts={dist} />
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
                  <td>{r.def.short}</td>
                  <td className="r num">{r.n}</td>
                  <td className="r num">{Math.round(r.rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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

        <div className="grid2 mt12">
          <Kpi label="Seguimientos solicitados" value={followUps} />
          <Kpi label="Riesgo atribuible" value={risks} hint="potencial o real" />
        </div>
        <p className="tiny muted mt16">
          Reporte generado automáticamente a partir de {ev.length} evaluaciones de {new Set(ev.map((c) => c.evaluation.attendingId)).size} adscritos (
          {[...new Set(ev.map((c) => c.evaluation.attendingId))].map((id) => userById(id).name.split(' ')[0]).join(', ')}).
        </p>
      </div>
    </>
  )
}
