// Verificación de la curva CUSUM contra la hoja "Prueba CUSUM" de la lista de cotejo (criterios B06, B07 y E01).
import { procDef } from '../data/catalog'
import { computeCusum, cusumParams } from '../lib/cusum'
import { CusumChart } from '../components/charts'
import { TopBar } from '../components/ui'

/** Secuencia ficticia de la hoja (1 = éxito, 0 = fallo): 4 fallos seguidos para cruzar H1 */
const SEQUENCE = [1, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
/** Columna "Esperado (suma acumulada)" de la hoja, para laringoscopia directa */
const EXPECTED = [
  -0.07235837684, 0.8552832463, 1.782924869, 2.710566493, 3.638208116, 3.565849739, 3.493491362, 3.421132985, 4.348774608, 4.276416232, 4.204057855, 4.131699478,
  4.059341101, 3.986982724, 3.914624347, 3.842265971, 3.769907594, 3.697549217, 3.62519084, 3.552832463,
]
const TOLERANCE = 0.01

export default function Verification() {
  const def = procDef('laringoscopia') as ReturnType<typeof procDef> & { p0: number; p1: number }
  const params = cusumParams(def)
  const items = SEQUENCE.map((ok, i) => ({ date: '2026-01-01', caseId: `prueba-${i + 1}`, grade: 'R1' as const, fail: ok === 0 }))
  // Sin periodo de gracia, para probar que la alerta se dispara al cruzar H1
  const test = computeCusum(items, def, 0)
  const rows = test.points.map((p, i) => ({ ...p, expected: EXPECTED[i], diff: p.value - EXPECTED[i] }))
  const allMatch = rows.every((r) => Math.abs(r.diff) <= TOLERANCE)

  return (
    <>
      <TopBar title="Verificación CUSUM" sub="Secuencia de prueba · datos ficticios" back fallback="/a/perfil" />
      <div className="screen">
        <div className="card flat" style={{ background: allMatch ? 'var(--good-soft)' : 'var(--crit-soft)', border: 0 }}>
          <div className="bold" style={{ color: allMatch ? 'var(--good-ink)' : '#a32424' }}>
            {allMatch ? `Coinciden los ${rows.length} valores (tolerancia ±${TOLERANCE})` : 'Hay valores que no coinciden'}
          </div>
          <div className="small ink2" style={{ marginTop: 4 }}>
            Alerta al cruzar H1: {test.alertAt ? `sí, en el intento #${test.alertAt}` : 'no'} (con periodo de gracia 0). Con la gracia configurada ({def.periodoGracia} intentos), un
            cruce dentro de ese periodo no dispara alerta.
          </div>
        </div>

        <div className="h2">Parámetros · {def.label}</div>
        <div className="card">
          <table className="data">
            <tbody>
              <tr>
                <td>p0 · p1</td>
                <td className="r num">
                  {def.p0} · {def.p1}
                </td>
              </tr>
              <tr>
                <td>α · β</td>
                <td className="r num">
                  {def.alfa} · {def.beta}
                </td>
              </tr>
              <tr>
                <td>s</td>
                <td className="r num">{params.s.toFixed(5)}</td>
              </tr>
              <tr>
                <td>h (H1 = −H0)</td>
                <td className="r num">{params.h1.toFixed(5)}</td>
              </tr>
              <tr>
                <td>Casos mínimos |H0 / (s − p0)|</td>
                <td className="r num">{params.minCases}</td>
              </tr>
            </tbody>
          </table>
          <div className="tiny muted mt8">Esperado en la hoja: s = 0.07236 · h = 2.94055. {def.fuente}.</div>
        </div>

        <div className="h2">Curva</div>
        <div className="card">
          <CusumChart result={test} />
        </div>

        <div className="h2">Intento por intento</div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th className="r">Resultado</th>
                <th className="r">Esperado</th>
                <th className="r">Pulso</th>
                <th className="r">¿Coincide?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.n}>
                  <td className="num">{r.n}</td>
                  <td className="r">{r.fail ? 'Fallo (0)' : 'Éxito (1)'}</td>
                  <td className="r num">{r.expected.toFixed(4)}</td>
                  <td className="r num">{r.value.toFixed(4)}</td>
                  <td className="r">{Math.abs(r.diff) <= TOLERANCE ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny muted mt8">Convención: éxito resta s; fallo suma (1 − s). Cruzar +h desde abajo = fallo mayor al aceptable; cruzar −h desde arriba = estándar.</div>
        </div>
      </div>
    </>
  )
}
