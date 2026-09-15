import { useEffect } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BarChart3, ClipboardList, Home, Plus, UserRound, Users } from 'lucide-react'
import { StoreProvider, useStore } from './store'
import { TabBar } from './components/ui'
import type { Role } from './types'
import Login from './screens/Login'
import ResidentHome from './screens/ResidentHome'
import CasesList from './screens/CasesList'
import NewCase from './screens/NewCase'
import Sent from './screens/Sent'
import Evaluate from './screens/Evaluate'
import Evaluated from './screens/Evaluated'
import CaseDetail from './screens/CaseDetail'
import Progress from './screens/Progress'
import ProcedureDetail from './screens/ProcedureDetail'
import AttendingHome from './screens/AttendingHome'
import Residents from './screens/Residents'
import Reports from './screens/Reports'
import Profile from './screens/Profile'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const home = (role: Role) => (role === 'residente' ? '/r' : '/a')

function Shell({ role, tabs }: { role: Role; tabs?: boolean }) {
  const { user, cases, redirectTo, clearRedirect } = useStore()
  const matches = !!user && user.role === role
  useEffect(() => {
    if (matches && redirectTo) clearRedirect()
  }, [matches, redirectTo, clearRedirect])
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={redirectTo ?? home(user.role)} replace />
  const pending = cases.filter((c) => c.status === 'pendiente' && c.attendingId === user.id).length
  const items =
    role === 'residente'
      ? [
          { to: '/r', label: 'Inicio', icon: <Home size={22} />, end: true },
          { to: '/r/casos', label: 'Mis casos', icon: <ClipboardList size={22} /> },
          { to: '/r/nuevo', label: 'Registrar', icon: <Plus size={26} />, fab: true },
          { to: '/r/progreso', label: 'Progreso', icon: <BarChart3 size={22} /> },
          { to: '/r/perfil', label: 'Perfil', icon: <UserRound size={22} /> },
        ]
      : [
          { to: '/a', label: 'Inicio', icon: <Home size={22} />, end: true, badge: pending },
          { to: '/a/residentes', label: 'Residentes', icon: <Users size={22} /> },
          { to: '/a/nuevo', label: 'Evaluar', icon: <Plus size={26} />, fab: true },
          { to: '/a/reportes', label: 'Reportes', icon: <BarChart3 size={22} /> },
          { to: '/a/perfil', label: 'Perfil', icon: <UserRound size={22} /> },
        ]
  return (
    <div className="app">
      <Outlet />
      {tabs && <TabBar items={items} />}
    </div>
  )
}

function Root() {
  const { user } = useStore()
  return <Navigate to={user ? home(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<Login />} />

          <Route path="/r" element={<Shell role="residente" tabs />}>
            <Route index element={<ResidentHome />} />
            <Route path="casos" element={<CasesList />} />
            <Route path="progreso" element={<Progress />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="caso/:id" element={<CaseDetail />} />
            <Route path="procedimiento/:proc" element={<ProcedureDetail />} />
          </Route>
          <Route path="/r" element={<Shell role="residente" />}>
            <Route path="nuevo" element={<NewCase mode="residente" />} />
            <Route path="enviado/:id" element={<Sent />} />
          </Route>

          <Route path="/a" element={<Shell role="adscrito" tabs />}>
            <Route index element={<AttendingHome />} />
            <Route path="residentes" element={<Residents />} />
            <Route path="residente/:rid" element={<Progress />} />
            <Route path="residente/:rid/procedimiento/:proc" element={<ProcedureDetail />} />
            <Route path="residente/:rid/caso/:id" element={<CaseDetail />} />
            <Route path="caso/:id" element={<CaseDetail />} />
            <Route path="reportes" element={<Reports />} />
            <Route path="perfil" element={<Profile />} />
          </Route>
          <Route path="/a" element={<Shell role="adscrito" />}>
            <Route path="nuevo" element={<NewCase mode="adscrito" />} />
            <Route path="evaluar/:id" element={<Evaluate />} />
            <Route path="listo/:id" element={<Evaluated />} />
          </Route>

          <Route path="*" element={<Root />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
