// Exportación de la base de investigación (CSV). En el demo la seudonimización se hace aquí con un
// hash; en producción la hará el backend con una tabla de correspondencia resguardada.
import { ANESTHESIA_LABEL, AREA_LABEL, ATTEMPT_TIMES, HELP, LOGRO, PROTOCOL_PROCEDURES, SHIFT_LABEL, procDef } from '../data/catalog'
import type { CaseRecord } from '../types'
import { procedureOutcome, wilson } from './success'

/** Identificador seudónimo estable (FNV-1a), sin nombres ni códigos */
export function pseudonym(prefix: string, id: string) {
  let h = 0x811c9dc5
  for (const ch of `pulso:${id}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return `${prefix}-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0')}`
}

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
}

function download(name: string, csv: string) {
  // BOM para que Excel respete los acentos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Un renglón por procedimiento registrado. Fecha a nivel de mes; sin nombres, códigos ni texto libre. */
export function researchRows(cases: CaseRecord[]) {
  return cases.flatMap((c) =>
    c.procedures.map((p) => {
      const o = procedureOutcome(p, c)
      const logro = procDef(p.type).criterios.logro
      return {
        caso: pseudonym('C', c.id),
        residente: pseudonym('R', c.residentId),
        adscrito: c.attendingId ? pseudonym('A', c.attendingId) : 'SIN_ADSCRITO',
        grado: c.grade,
        mes: c.date.slice(0, 7),
        jornada: SHIFT_LABEL[c.shift],
        area: AREA_LABEL[c.area],
        urgencia: c.urgency,
        asa: c.asa,
        anestesia: ANESTHESIA_LABEL[c.anesthesia],
        procedimiento: procDef(p.type).label,
        estado_procedimiento: procDef(p.type).estado,
        primer_operador: p.firstOperator ? 1 : 0,
        lo_logro_autorreporte: p.success ? 1 : 0,
        intentos: p.attempts === 6 ? '6+' : p.attempts,
        tiempo: ATTEMPT_TIMES.find((t) => t.id === p.time)?.label,
        ayuda: HELP[p.help].label,
        criterio_logro: logro ? LOGRO[logro].ok : '',
        cumplio_logro: p.logro === undefined ? '' : p.logro ? 1 : 0,
        resultado: o.status,
        motivo_no_cuenta: o.excludedWhy ?? '',
        corregido_por_adscrito: o.override ? 1 : 0,
        oscore: c.evaluation?.supervision[p.id] ?? '',
        confiabilidad: c.evaluation?.entrustment ?? '',
        evento_critico: c.criticalEvent ? 1 : 0,
        riesgo_paciente: c.evaluation?.patientRisk ? 1 : 0,
        estado_caso: c.status,
      }
    }),
  )
}

/** Agregado por grado y procedimiento: n, éxitos, tasa e IC95% (Wilson) */
export function aggregateRows(cases: CaseRecord[]) {
  const out: Record<string, unknown>[] = []
  for (const g of ['R1', 'R2', 'R3'] as const)
    for (const def of PROTOCOL_PROCEDURES) {
      const list = cases.filter((c) => c.grade === g).flatMap((c) => c.procedures.filter((p) => p.type === def.id).map((p) => procedureOutcome(p, c)))
      const valid = list.filter((o) => o.status === 'exito' || o.status === 'fallo')
      const ok = valid.filter((o) => o.status === 'exito').length
      const [lo, hi] = wilson(ok, valid.length)
      out.push({
        grado: g,
        procedimiento: def.label,
        estado: def.estado,
        registrados: list.length,
        validados: valid.length,
        exitos: ok,
        tasa_exito: valid.length ? (ok / valid.length).toFixed(3) : '',
        ic95_inf: valid.length ? lo.toFixed(3) : '',
        ic95_sup: valid.length ? hi.toFixed(3) : '',
        provisionales: list.filter((o) => o.status === 'provisional').length,
        no_cuentan: list.filter((o) => o.status === 'no-cuenta').length,
      })
    }
  return out
}

export const exportResearch = (cases: CaseRecord[]) => download(`pulso-datos-seudonimizados-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(researchRows(cases)))
export const exportAggregate = (cases: CaseRecord[]) => download(`pulso-agregado-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(aggregateRows(cases)))
