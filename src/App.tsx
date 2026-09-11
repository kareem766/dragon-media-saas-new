import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Support from './pages/Support'
import Dashboard from './pages/Dashboard'
import CRM from './pages/CRM'
import CustomerDetail from './pages/CustomerDetail'
import DealDetail from './pages/DealDetail'
import Pipeline from './pages/Pipeline'
import Services from './pages/Services'
import Campaigns from './pages/Campaigns'
import Inbox from './pages/Inbox'
import Account from './pages/Account';
import Ryan from './pages/Ryan'
import KnowledgeBase from './pages/KnowledgeBase'
import HandoffRequests from './pages/HandoffRequests'
import Automations from './pages/Automations'
import AdminDashboard from './pages/AdminDashboard'
import AdminPayments from './pages/AdminPayments'
import AdminAuditLogs from './pages/AdminAuditLogs'
import AdminSettings from './pages/AdminSettings'
import AdminBranding from './pages/AdminBranding'
import AdminOrganizations from './pages/AdminOrganizations'
import AdminPlans from './pages/AdminPlans'
import AdminRoles from './pages/AdminRoles'
import AdminRyanCredits from './pages/AdminRyanCredits'
import AdminTickets from './pages/AdminTickets'
import Tickets from './pages/Tickets'
import Search from './pages/Search'
import Plans from './pages/Plans'
import PaymentRequest from './pages/PaymentRequest'
import Tasks from './pages/Tasks'
import Appointments from './pages/Appointments'
import Billing from './pages/Billing'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/support" element={<Support />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/admin/organizations"
                element={<AdminOrganizations />}
              />
              <Route path="/crm" element={<CRM />} />
              <Route path="/crm/customer/:id" element={<CustomerDetail />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/pipeline/deal/:id" element={<DealDetail />} />
              <Route path="/services" element={<Services />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/ryan" element={<Ryan />} />
              <Route path="/ryan/knowledge" element={<KnowledgeBase />} />
              <Route path="/ryan/handoff" element={<HandoffRequests />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/branding" element={<AdminBranding />} />        
              <Route path="/admin/plans" element={<AdminPlans />} />
              <Route
                path="/admin/ryan-credits"
                element={<AdminRyanCredits />}
              />
              <Route path="/admin/roles" element={<AdminRoles />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/search" element={<Search />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/billing/pay" element={<PaymentRequest />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
