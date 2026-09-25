import { useEffect, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Info, TrendingDown } from 'lucide-react'
import { initials } from '../data/users'
import type { Alert } from '../lib/stats'
import type { CusumState } from '../lib/cusum'
import { CUSUM_STATE_LABEL } from '../lib/cusum'

export function TopBar({
  title,
  sub,
  back,
  fallback = '/',
  right,
}: {
  title: ReactNode
  sub?: ReactNode
  back?: boolean | string
  /** A dónde ir si ya no hay historial atrás (evita salirse de la app) */
  fallback?: string
  right?: ReactNode
}) {
  const nav = useNavigate()
  const loc = useLocation()
  const goBack = () => {
    if (typeof back === 'string') nav(back)
    else if (loc.key === 'default') nav(fallback, { replace: true })
    else nav(-1)
  }
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label="Regresar" onClick={goBack}>
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="grow">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </header>
  )
}

export function Avatar({ name, att, lg }: { name: string; att?: boolean; lg?: boolean }) {
  return <div className={`avatar${att ? ' att' : ''}${lg ? ' lg' : ''}`}>{initials(name)}</div>
}

export interface TabItem {
  to: string
  label: string
  icon: ReactNode
  badge?: number
  fab?: boolean
  end?: boolean
}

export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className="tabbar fixed-bottom" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive && !t.fab ? ' active' : ''}`}>
          {t.fab ? <span className="tab-fab">{t.icon}</span> : t.icon}
          {!t.fab && <span>{t.label}</span>}
          {!!t.badge && <span className="dot">{t.badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: { id: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o.id)} type="button" className={`chip${small ? ' sm' : ''}${value === o.id ? ' on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MultiChips({ options, value, onChange, small }: { options: string[]; value: string[]; onChange: (v: string[]) => void; small?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} type="button" className={`chip${small ? ' sm' : ''}${on ? ' on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function ChoiceList<T extends string | number>({
  options,
  value,
  onPick,
  numbered,
}: {
  options: { v: T; title: string; desc?: string }[]
  value: T | undefined
  onPick: (v: T) => void
  numbered?: boolean
}) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button key={String(o.v)} type="button" className={`choice${value === o.v ? ' on' : ''}`} onClick={() => onPick(o.v)}>
          {numbered && <span className="n">{String(o.v)}</span>}
          <span className="grow">
            <div>{o.title}</div>
            {o.desc && <div className="desc">{o.desc}</div>}
          </span>
        </button>
      ))}
    </div>
  )
}

export function YesNo({ value, onPick, yes = 'Sí', no = 'No', neutral }: { value: boolean | undefined; onPick: (v: boolean) => void; yes?: string; no?: string; neutral?: boolean }) {
  return (
    <div className="big-choices">
      <button type="button" className={`big-choice${neutral ? '' : ' yes'}${value === true ? ' on' : ''}`} onClick={() => onPick(true)}>
        {yes}
      </button>
      <button type="button" className={`big-choice${neutral ? '' : ' no'}${value === false ? ' on' : ''}`} onClick={() => onPick(false)}>
        {no}
      </button>
    </div>
  )
}

/** Escala segmentada 1..max con opción "N/O" (no observado = null) */
export function ScaleSeg({ max, value, onChange, allowNo = true }: { max: 4 | 5; value: number | null | undefined; onChange: (v: number | null) => void; allowNo?: boolean }) {
  return (
    <div className="seg">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
      {allowNo && (
        <button type="button" className={`no${value === null ? ' on' : ''}`} onClick={() => onChange(null)}>
          N/O
        </button>
      )}
    </div>
  )
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="grabber" />
        {children}
      </div>
    </>
  )
}

export function AlertCard({ alert, who, onClick }: { alert: Alert; who?: string; onClick?: () => void }) {
  const Icon = alert.kind === 'cusum' ? TrendingDown : alert.level === 'info' ? Info : AlertTriangle
  const color = alert.level === 'critical' ? 'var(--crit)' : alert.level === 'warning' ? '#c98500' : 'var(--series-1)'
  return (
    <button type="button" className={`alert ${alert.level}`} style={{ border: 0, borderLeft: `4px solid ${color}`, width: '100%', textAlign: 'left' }} onClick={onClick}>
      <span className="ico" style={{ color }}>
        <Icon size={18} />
      </span>
      <span className="grow">
        {who && <div className="tiny muted bold">{who}</div>}
        <div className="t">{alert.title}</div>
        <div className="d">{alert.detail}</div>
      </span>
      {onClick && <ChevronRight size={18} className="muted" />}
    </button>
  )
}

export function Kpi({ label, value, delta, good, hint }: { label: string; value: ReactNode; delta?: string; good?: boolean; hint?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${good ? 'up' : 'down'}`}>{delta}</div>}
      {hint && <div className="tiny muted">{hint}</div>}
    </div>
  )
}

export function CusumBadge({ state }: { state: CusumState }) {
  const cls = state === 'competente' ? 'good' : state === 'alerta' ? 'crit' : state === 'curva' ? 'brand' : ''
  const Icon = state === 'competente' ? CheckCircle2 : state === 'alerta' ? CircleAlert : null
  return (
    <span className={`badge ${cls}`}>
      {Icon && <Icon size={12} />}
      {state === 'curva' ? 'En curva' : state === 'competente' ? 'Competente' : state === 'alerta' ? 'Alerta' : CUSUM_STATE_LABEL[state]}
    </span>
  )
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="card center" style={{ padding: '28px 20px' }}>
      <div className="muted" style={{ display: 'grid', placeItems: 'center' }}>
        {icon}
      </div>
      <div className="bold mt8">{title}</div>
      <div className="small muted mt8">{text}</div>
    </div>
  )
}
