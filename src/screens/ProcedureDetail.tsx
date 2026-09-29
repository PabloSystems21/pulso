import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import { useStore } from '../store'
import type { ProcedureType } from '../types'
import { HELP, criteriaText, hasCurve, oscoreTarget, procDef } from '../data/catalog'
import { userById } from '../data/users'
import { CUSUM_STATE_HINT, CUSUM_STATE_LABEL } from '../lib/cusum'
import { avg, casesOf, procedureSummaries } from '../lib/stats'
import { SMALL_N, rateText } from '../lib/success'
import { fmtDate } from '../lib/dates'
import { CusumBadge, Kpi, TopBar } from '../components/ui'
import { CusumChart, ORDINAL_BLUE, RateBars, StackedBar, blocks } from '../components/charts'
import { attemptText } from '../components/case'

export default function ProcedureDetail() {
  const { rid, proc } = useParams()
  const { user, cases } = useStore()
  const u = userById(rid ?? user!.id)
  const base = rid ? `/a/residente/${rid}` : '/r'
  const def = procDef(proc as ProcedureType)
  const mine = useMemo(() => casesOf(cases, u.id), [cases, u.id])
  const s = useMemo(() => procedureSummaries(mine).find((x) => x.def.id === def.id), [mine, def.id])
  if (!s) return <TopBar title={def.label} back fallback={base} />
  const r = s.cusum
  const attempts = s.attempts
  const n = attempts.length
  const helpDist = HELP.map((h) => ({ label: h.label, value: attempts.filter((x) => x.proc.help === h.id).length, color: ORDINAL_BLUE[h.id] }))
  const recent = attempts.slice(-10).reverse()
  const notCounted = s.exposure - n - s.provisional
  // Desglose por grado: qué parte de los intentos fue de R1, R2 y R3
  const byGrade = (['R1', 'R2', 'R3'] as const)
    .map((g) => {
      const list = attempts.filter((x) => x.grade === g)
      return { g, n: list.length, ok: list.filter((x) => !x.fail).length, oscore: avg(list.map((x) => x.oscore)) }
    })
    .filter((x) => x.n > 0)

  const headline = !r
    ? `${n} intentos validados · tasa de éxito ${rateText(s.ok, n)}`
    : r.state === 'estandar'
      ? `Alcanzó el estándar en el intento #${r.competentAt}`
      : r.state === 'alerta'
        ? `Arriba del límite superior desde el intento #${r.alertAt}`
        : r.state === 'insuficiente'
          ? `${r.n} de ${r.minCases} intentos mínimos para concluir`
          : r.state === 'curva'
            ? `${r.n} intentos · sin cruzar ningún límite`
            : 'Sin intentos validados como primer operador'

  return (
    <>
      <TopBar title={def.label} sub={rid ? u.short : 'Curva de aprendizaje'} back fallback={base} />
      <div className="screen">
        <div className="card">
          <CusumBadge state={r ? r.state : 'calibracion'} />
          <div className="bold mt8" style={{ fontSize: 17 }}>
            {headline}
          </div>
          <div className="small muted">
            {r ? CUSUM_STATE_HINT[r.state] : 'Procedimiento en calibración: se registran los intentos y la tasa de éxito, pero todavía no hay curva CUSUM ni alertas. Sus parámetros se estimarán en el ciclo 2 con la tasa de fallo local.'}
          </div>
        </div>

        <div className="grid2 mt12">
          <Kpi
            label="Intentos validados"
            value={n}
            hint={[s.provisional ? `${s.provisional} por validar` : '', notCounted > 0 ? `${notCounted} no cuentan` : ''].filter(Boolean).join(' · ') || 'como primer operador'}
          />
          <Kpi label="Tasa de éxito" value={n ? `${Math.round((s.ok / n) * 100)}%` : '—'} hint={n ? `${rateText(s.ok, n).split(' ').slice(1).join(' ')}${n < SMALL_N ? ' · n < 30' : ''}` : undefined} />
          <Kpi label="O-SCORE promedio" value={s.supervision?.toFixed(1) ?? '—'} hint={u.grade ? `Referencia provisional ≥ ${oscoreTarget(u.grade, def.id)} (${u.grade})` : 'en este procedimiento'} />
          {r ? (
            <Kpi label="Casos mínimos" value={r.minCases} hint={`para concluir · gracia ${r.grace}`} />
          ) : (
            <Kpi label="Última exposición" value={s.daysSince !== undefined ? `${s.daysSince} d` : '—'} hint="días atrás" />
          )}
        </div>

        <div className="h2">Criterios de éxito</div>
        <div className="card">
          <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {criteriaText(def).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="tiny muted mt8">
            Mismo estándar para todos los grados. Solo cuentan los intentos validados por el adscrito.
            {def.criteriosProvisionales && ' Criterios provisionales: pendientes de definir por enseñanza.'} Fuente: {def.fuente}.
          </div>
        </div>

        {r && hasCurve(def) ? (
          <>
            <div className="h2">Curva CUSUM</div>
            <div className="card">
              {r.n ? <CusumChart result={r} /> : <div className="small muted">Sin datos todavía.</div>}
              <div className="legend">
                <span>
                  <i style={{ background: 'var(--series-1)' }} />
                  CUSUM acumulada
                </span>
                <span>
                  <i style={{ background: 'var(--series-2)', width: 8, height: 8, borderRadius: 4 }} />
                  Fallo
                </span>
                <span style={{ color: 'var(--good)' }}>
                  <i className="dash" />
                  <span className="ink2">H0 · estándar (p0 = {Math.round(def.p0 * 100)}% de fallo)</span>
                </span>
                <span style={{ color: 'var(--crit)' }}>
                  <i className="dash" />
                  <span className="ink2">H1 · inaceptable (p1 = {Math.round(def.p1 * 100)}% de fallo)</span>
                </span>
              </div>
              <div className="tiny muted mt12" style={{ lineHeight: 1.5 }}>
                Cada éxito baja la curva {r.s.toFixed(3)} y cada fallo la sube {(1 - r.s).toFixed(3)} (α = {def.alfa}, β = {def.beta}). Cruzar H0 hacia abajo = alcanzó el estándar.
                Estar arriba de H1 después de {r.grace} intentos (periodo de gracia) = alerta formativa. Antes de {r.minCases} intentos la curva es insuficiente para concluir. Eje
                X = número de intento; el fondo marca el grado que tenía.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="h2">Tasa de éxito por bloques de intentos</div>
            <div className="card">
              <RateBars rows={blocks([attempts.map((a) => a.fail)])} />
            </div>
          </>
        )}

        {byGrade.length > 0 && (
          <>
            <div className="h2">Por grado</div>
            <div className="card">
              <table className="data">
                <thead>
                  <tr>
                    <th>Grado</th>
                    <th className="r">n</th>
                    <th className="r">Tasa de éxito</th>
                    <th className="r">O-SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {byGrade.map((x) => (
                    <tr key={x.g}>
                      <td className="bold">{x.g}</td>
                      <td className="r num">{x.n}</td>
                      <td className="r num">{rateText(x.ok, x.n)}</td>
                      <td className="r num">
                        {x.oscore?.toFixed(1) ?? '—'} <span className="tiny muted">/ ref. {oscoreTarget(x.g, def.id)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tiny muted mt8">n = intentos validados. Mismo estándar de éxito en los tres grados.</div>
            </div>
          </>
        )}

        <div className="h2">Ayuda requerida</div>
        <div className="card">
          <StackedBar parts={helpDist} />
        </div>

        <div className="h2">Últimos intentos validados</div>
        <div className="list">
          {recent.map(({ c, proc: p, fail, oscore }) => (
            <Link key={p.id} to={`${base}/caso/${c.id}`} className="list-row">
              <span style={{ color: !fail ? 'var(--good-ink)' : '#a32424' }}>{!fail ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
              <div className="grow">
                <div className="small bold">
                  {attemptText(p)} · {HELP[p.help].label.toLowerCase()}
                </div>
                <div className="tiny muted">
                  {fmtDate(c.date)} · {c.grade} · {fail ? 'fallo' : 'éxito'}
                  {oscore ? ` · O-SCORE ${oscore}` : ''}
                </div>
              </div>
              <ChevronRight size={16} className="muted" />
            </Link>
          ))}
          {!recent.length && <div className="list-row small muted">Todavía no hay intentos validados.</div>}
        </div>
        {r && <p className="tiny muted mt12">Estado: {CUSUM_STATE_LABEL[r.state]}.</p>}
      </div>
    </>
  )
}
