import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CRM from './pages/CRM'
import CustomerDetail from './pages/CustomerDetail'
import DealDetail from './pages/DealDetail'
import Automations from './pages/Automations'
import Pipeline from './pages/Pipeline'
import Services from './pages/Services'
import Campaigns from './pages/Campaigns'
import Inbox from './pages/Inbox'
import Ryan from './pages/Ryan'
import Tasks from './pages/Tasks'
import Appointments from './pages/Appointments'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/crm/customer/:id" element={<CustomerDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/pipeline/deal/:id" element={<DealDetail />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/services" element={<Services />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/ryan" element={<Ryan />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
