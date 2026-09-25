import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useStore } from '../store'
import { casesOf } from '../lib/stats'
import { monthLong, parseDate } from '../lib/dates'
import { Empty, TopBar } from '../components/ui'
import { CaseRow } from '../components/case'

type Filter = 'todos' | 'pendiente' | 'evaluado'

/** Residente: sus casos. Adscrito: los casos que él evaluó. */
export default function CasesList() {
  const { user, cases } = useStore()
  const me = user!
  const isResident = me.role === 'residente'
  const [filter, setFilter] = useState<Filter>('todos')
  const [limit, setLimit] = useState(40)

  const list = useMemo(() => {
    const l = isResident ? casesOf(cases, me.id) : cases.filter((c) => c.evaluation?.attendingId === me.id)
    return [...l].reverse()
  }, [cases, me, isResident])
  const shown = list.filter((c) => !isResident || filter === 'todos' || c.status === filter)

  const groups: { key: string; label: string; items: typeof shown }[] = []
  shown.slice(0, limit).forEach((c) => {
    const key = c.date.slice(0, 7)
    const d = parseDate(c.date)
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, label: `${monthLong(d.getMonth())} ${d.getFullYear()}`, items: [] }))
    g.items.push(c)
  })

  return (
    <>
      <TopBar title={isResident ? 'Mis casos' : 'Casos que evalué'} sub={`${list.length} en total`} />
      <div className="screen">
        {isResident && (
          <div className="segmented-tabs">
            {(
              [
                ['todos', 'Todos'],
                ['pendiente', 'Pendientes'],
                ['evaluado', 'Evaluados'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
        {!shown.length && (
          <div className="mt16">
            <Empty icon={<ClipboardList size={32} />} title="Nada por aquí" text={isResident ? 'Cuando registres un caso aparecerá en esta lista.' : 'Las evaluaciones que hagas aparecerán aquí.'} />
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="h2" style={{ textTransform: 'capitalize' }}>
              {g.label} <span className="small muted">{g.items.length}</span>
            </div>
            <div className="list">
              {g.items.map((c) => (
                <CaseRow key={c.id} c={c} to={isResident ? `/r/caso/${c.id}` : `/a/caso/${c.id}`} showResident={!isResident} />
              ))}
            </div>
          </div>
        ))}
        {shown.length > limit && (
          <button className="btn block mt16" onClick={() => setLimit(limit + 40)}>
            Ver más
          </button>
        )}
      </div>
    </>
  )
}
