import React from 'react'
import { HashRouter, Routes, Route, Link, Outlet } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import PermissionRoute from './components/PermissionRoute'
import FeatureRoute from './components/FeatureRoute'
import Layout from './components/Layout'
import SiteFooter from './components/SiteFooter'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Support from './pages/Support'
import RefundPolicy from './pages/RefundPolicy'
import Dashboard from './pages/Dashboard'
import CRM from './pages/CRM'
import CustomerDetail from './pages/CustomerDetail'
import DealDetail from './pages/DealDetail'
import Pipeline from './pages/Pipeline'
import Services from './pages/Services'
import Campaigns from './pages/Campaigns'
import Inbox from './pages/Inbox'
import Account from './pages/Account'
import Ryan from './pages/Ryan'
import RyanAssistant from './pages/RyanAssistant'
import RyanSettings from './pages/RyanSettings'
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
import AdminRyanPackages from './pages/AdminRyanPackages'
import AdminRoles from './pages/AdminRoles'
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
import MetaConnections from './pages/MetaConnections'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function PublicShell() {
  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 text-ink-950 flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

function RyanPageShell() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-900/10 bg-white p-3 shadow-sm">
        <span className="mr-auto text-sm font-semibold text-ink-950">إدارة Ryan</span>
        <Link to="/ryan/assistant" className="rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400">المساعد الداخلي</Link>
        <Link to="/ryan/settings" className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800">إعدادات Ryan</Link>
        <Link to="/ryan/knowledge" className="rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-ink-50">قاعدة المعرفة</Link>
        <Link to="/ryan/handoff" className="rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-semibold text-ink-900 transition hover:bg-ink-50">طلبات التحويل</Link>
      </div>
      <Ryan />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/home" element={<Landing />} />

            <Route element={<PublicShell />}>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/support" element={<Support />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
            </Route>

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/crm" element={<PermissionRoute resource="customers"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><CRM /></FeatureRoute></PermissionRoute>} />
              <Route path="/crm/customer/:id" element={<PermissionRoute resource="customers"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><CustomerDetail /></FeatureRoute></PermissionRoute>} />
              <Route path="/pipeline" element={<PermissionRoute resource="deals"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><Pipeline /></FeatureRoute></PermissionRoute>} />
              <Route path="/pipeline/deal/:id" element={<PermissionRoute resource="deals"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><DealDetail /></FeatureRoute></PermissionRoute>} />
              <Route path="/services" element={<Services />} />
              <Route path="/campaigns" element={<FeatureRoute feature="campaigns" featureName="الحملات التسويقية"><Campaigns /></FeatureRoute>} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/ryan" element={<FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanPageShell /></FeatureRoute>} />
              <Route path="/ryan/assistant" element={<FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanAssistant /></FeatureRoute>} />
              <Route path="/ryan/settings" element={<FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanSettings /></FeatureRoute>} />
              <Route path="/ryan/knowledge" element={<FeatureRoute feature="ryan" featureName="Ryan الذكي"><KnowledgeBase /></FeatureRoute>} />
              <Route path="/ryan/handoff" element={<FeatureRoute feature="ryan" featureName="Ryan الذكي"><HandoffRequests /></FeatureRoute>} />
              <Route path="/automations" element={<FeatureRoute feature="automations" featureName="الأتمتة"><Automations /></FeatureRoute>} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/search" element={<Search />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/billing/pay" element={<PaymentRequest />} />
              <Route path="/tasks" element={<PermissionRoute resource="tasks"><Tasks /></PermissionRoute>} />
              <Route path="/appointments" element={<PermissionRoute resource="appointments"><Appointments /></PermissionRoute>} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/reports" element={<FeatureRoute feature="advanced_reports" featureName="التقارير المتقدمة"><Reports /></FeatureRoute>} />
              <Route path="/users" element={<PermissionRoute resource="users"><Users /></PermissionRoute>} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<PermissionRoute resource="settings"><Settings /></PermissionRoute>} />
              <Route path="/integrations/meta" element={<MetaConnections />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/organizations" element={<AdminRoute><AdminOrganizations /></AdminRoute>} />
              <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
              <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />
              <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
              <Route path="/admin/branding" element={<AdminRoute><AdminBranding /></AdminRoute>} />
              <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
              <Route path="/admin/ryan-credits" element={<AdminRoute><AdminRyanPackages /></AdminRoute>} />
              <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
              <Route path="/admin/tickets" element={<AdminRoute><AdminTickets /></AdminRoute>} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
