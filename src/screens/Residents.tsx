import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { RESIDENTS } from '../data/users'
import { expectedBand } from '../data/catalog'
import { avg, caseSupervision, casesOf, chartCases, monthsIntoGrade, procedureSummaries, residentAlerts, rolling } from '../lib/stats'
import { Avatar, TopBar } from '../components/ui'
import { Sparkline } from '../components/charts'

export default function Residents() {
  const { cases } = useStore()
  const rows = useMemo(
    () =>
      RESIDENTS.map((u) => {
        const mine = casesOf(cases, u.id)
        const ev = chartCases(mine)
        const sup = avg(ev.slice(-10).map((c) => caseSupervision(c.evaluation)))
        const [lo, hi] = expectedBand(u.grade!, monthsIntoGrade(u))
        const alerts = residentAlerts(u, mine, '')
        const competent = procedureSummaries(mine).filter((p) => p.cusum.state === 'competente').length
        return {
          u,
          n: mine.length,
          sup,
          lo,
          hi,
          crit: alerts.filter((a) => a.level === 'critical').length,
          warn: alerts.filter((a) => a.level !== 'critical').length,
          competent,
          trend: rolling(ev.map((c) => caseSupervision(c.evaluation) ?? 0), 8).slice(-40),
        }
      }),
    [cases],
  )

  return (
    <>
      <TopBar title="Residentes" sub={`${RESIDENTS.length} en el programa`} />
      <div className="screen">
        {(['R1', 'R2', 'R3'] as const).map((g) => (
          <div key={g}>
            <div className="h2">
              {g}
              <span className="tiny muted">
                Esperado hoy: {rows.find((r) => r.u.grade === g)!.lo.toFixed(1)}–{rows.find((r) => r.u.grade === g)!.hi.toFixed(1)}
              </span>
            </div>
            <div className="list">
              {rows
                .filter((r) => r.u.grade === g)
                .map((r) => (
                  <Link key={r.u.id} to={`/a/residente/${r.u.id}`} className="list-row">
                    <Avatar name={r.u.name} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="bold">{r.u.short}</div>
                      <div className="tiny muted num">
                        {r.n} casos · O-SCORE {r.sup?.toFixed(1) ?? '—'} · {r.competent} competencias
                      </div>
                      <div className="row wrap" style={{ gap: 6, marginTop: 5 }}>
                        {r.crit > 0 && (
                          <span className="badge crit">
                            {r.crit} alerta{r.crit > 1 ? 's' : ''}
                          </span>
                        )}
                        {r.warn > 0 && (
                          <span className="badge warn">
                            {r.warn} aviso{r.warn > 1 ? 's' : ''}
                          </span>
                        )}
                        {r.sup !== null && r.sup < r.lo ? <span className="badge warn">Bajo lo esperado</span> : <span className="badge good">En rango</span>}
                      </div>
                    </div>
                    <Sparkline values={r.trend} />
                    <ChevronRight size={18} className="muted" />
                  </Link>
                ))}
            </div>
          </div>
        ))}
        <div className="tiny muted mt12">O-SCORE = promedio de los últimos 10 casos evaluados. La línea es el promedio móvil de los últimos 40.</div>
      </div>
    </>
  )
}
