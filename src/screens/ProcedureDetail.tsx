import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import { useStore } from '../store'
import type { ProcedureType } from '../types'
import { HELP, oscoreTarget, procDef } from '../data/catalog'
import { userById } from '../data/users'
import { CUSUM_RULE, CUSUM_STATE_LABEL } from '../lib/cusum'
import { avg, casesOf, cusumItems, procedureSummaries } from '../lib/stats'
import { fmtDate } from '../lib/dates'
import { CusumBadge, Kpi, TopBar } from '../components/ui'
import { CusumChart, ORDINAL_BLUE, StackedBar } from '../components/charts'
import { attemptText } from '../components/case'

export default function ProcedureDetail() {
  const { rid, proc } = useParams()
  const { user, cases } = useStore()
  const u = userById(rid ?? user!.id)
  const base = rid ? `/a/residente/${rid}` : '/r'
  const def = procDef(proc as ProcedureType)
  const mine = useMemo(() => casesOf(cases, u.id), [cases, u.id])
  const s = useMemo(() => procedureSummaries(mine).find((x) => x.def.id === def.id), [mine, def.id])
  // Lo mismo que entra a la CUSUM: primer operador, con adscrito y no excluido
  const records = useMemo(() => cusumItems(mine, def.id).map((it) => ({ c: it.c, p: it.proc, grade: it.grade, oscore: it.oscore })), [mine, def.id])
  if (!s) return <TopBar title={def.label} back fallback={base} />
  const r = s.cusum
  const helpDist = HELP.map((h) => ({ label: h.label, value: records.filter((x) => x.p.help === h.id).length, color: ORDINAL_BLUE[h.id] }))
  const recent = records.slice(-10).reverse()
  // Desglose por grado: qué parte de la curva fue de R1, R2 y R3
  const byGrade = (['R1', 'R2', 'R3'] as const)
    .map((g) => {
      const pts = r.points.filter((x) => x.grade === g)
      const recs = records.filter((x) => x.grade === g)
      return { g, n: pts.length, ok: pts.filter((x) => !x.fail).length, oscore: avg(recs.map((x) => x.oscore)) }
    })
    .filter((x) => x.n > 0)

  const headline =
    r.state === 'competente'
      ? `Competencia alcanzada en el intento #${r.competentAt}`
      : r.state === 'alerta'
        ? `${r.points.slice(-6).filter((p) => p.fail).length} de los últimos 6 intentos contaron como falla`
        : r.state === 'curva'
          ? `${r.n} registros · aún sin cruzar la línea aceptable`
          : 'Sin registros como primer operador'

  return (
    <>
      <TopBar title={def.label} sub={rid ? u.short : 'Curva de aprendizaje'} back fallback={base} />
      <div className="screen">
        <div className="card">
          <CusumBadge state={r.state} />
          <div className="bold mt8" style={{ fontSize: 17 }}>
            {headline}
          </div>
          <div className="small muted">{CUSUM_STATE_LABEL[r.state]}</div>
        </div>

        <div className="grid2 mt12">
          <Kpi label="N acumulado" value={r.n} hint={s.exposure > r.n ? `+${s.exposure - r.n} que no suman (parcial o sin adscrito)` : 'como primer operador'} />
          <Kpi label="Tasa de éxito" value={`${Math.round(r.successRate * 100)}%`} hint={`Aceptable ≥ ${Math.round((1 - def.p0) * 100)}%`} />
          <Kpi label="O-SCORE promedio" value={s.supervision?.toFixed(1) ?? '—'} hint={u.grade ? `Esperado ≥ ${oscoreTarget(u.grade, def.id)} (${u.grade})` : 'en este procedimiento'} />
          <Kpi
            label="Última exposición"
            value={s.daysSince !== undefined ? `${s.daysSince} d` : '—'}
            hint={s.daysSince !== undefined && s.daysSince > 40 ? 'Periodo sin exposición' : 'días atrás'}
          />
        </div>

        <div className="h2">CUSUM</div>
        <div className="card">
          {r.n ? <CusumChart result={r} /> : <div className="small muted">Sin datos todavía.</div>}
          <div className="legend">
            <span>
              <i style={{ background: 'var(--series-1)' }} />
              CUSUM acumulada
            </span>
            <span>
              <i style={{ background: 'var(--series-2)', width: 8, height: 8, borderRadius: 4 }} />
              Falla
            </span>
            <span style={{ color: 'var(--good)' }}>
              <i className="dash" />
              <span className="ink2">Aceptable ({Math.round(def.p0 * 100)}% falla, provisional)</span>
            </span>
            <span style={{ color: 'var(--crit)' }}>
              <i className="dash" />
              <span className="ink2">Inaceptable ({Math.round(def.p1 * 100)}% falla, provisional)</span>
            </span>
          </div>
          <div className="tiny muted mt12" style={{ lineHeight: 1.5 }}>
            Cada éxito baja la curva {r.s.toFixed(2)} y cada falla la sube {(1 - r.s).toFixed(2)}. Eje X = número de intento; el fondo marca el grado que tenía. {CUSUM_RULE.R1}.{' '}
            {CUSUM_RULE.R2.replace('(R2)', '(R2 y R3)')}. Los límites son de referencia hasta tener la curva de la sede.
          </div>
        </div>

        {byGrade.length > 0 && (
          <>
            <div className="h2">Por grado</div>
            <div className="card">
              <table className="data">
                <thead>
                  <tr>
                    <th>Grado</th>
                    <th className="r">N</th>
                    <th className="r">Éxito</th>
                    <th className="r">O-SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {byGrade.map((x) => (
                    <tr key={x.g}>
                      <td className="bold">{x.g}</td>
                      <td className="r num">{x.n}</td>
                      <td className="r num">{Math.round((x.ok / x.n) * 100)}%</td>
                      <td className="r num">
                        {x.oscore?.toFixed(1) ?? '—'} <span className="tiny muted">/ ≥{oscoreTarget(x.g, def.id)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tiny muted mt8">El éxito se mide con la tolerancia del grado que tenía en cada intento.</div>
            </div>
          </>
        )}

        <div className="h2">Ayuda requerida</div>
        <div className="card">
          <StackedBar parts={helpDist} />
        </div>

        <div className="h2">Últimos registros</div>
        <div className="list">
          {recent.map(({ c, p }) => (
            <Link key={p.id} to={`${base}/caso/${c.id}`} className="list-row">
              <span style={{ color: p.success ? 'var(--good-ink)' : '#a32424' }}>{p.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
              <div className="grow">
                <div className="small bold">
                  {attemptText(p)} · {HELP[p.help].label.toLowerCase()}
                </div>
                <div className="tiny muted">
                  {fmtDate(c.date)} · {c.grade}
                  {c.evaluation?.supervision[p.id] ? ` · O-SCORE ${c.evaluation.supervision[p.id]}` : ' · sin evaluar'}
                </div>
              </div>
              <ChevronRight size={16} className="muted" />
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
