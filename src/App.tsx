import React, { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Link, Outlet } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import PermissionRoute from './components/PermissionRoute'
import FeatureRoute from './components/FeatureRoute'
import Layout from './components/Layout'
import SiteFooter from './components/SiteFooter'
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const ConfirmSignup = lazy(() => import('./pages/ConfirmSignup'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Support = lazy(() => import('./pages/Support'))
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CRM = lazy(() => import('./pages/CRM'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const DealDetail = lazy(() => import('./pages/DealDetail'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Services = lazy(() => import('./pages/Services'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const AIContentStudio = lazy(() => import('./pages/AIContentStudio'))
const Inbox = lazy(() => import('./pages/Inbox'))
const Account = lazy(() => import('./pages/Account'))
const Ryan = lazy(() => import('./pages/Ryan'))
const RyanAssistant = lazy(() => import('./pages/RyanAssistant'))
const RyanSettings = lazy(() => import('./pages/RyanSettings'))
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'))
const HandoffRequests = lazy(() => import('./pages/HandoffRequests'))
const Automations = lazy(() => import('./pages/Automations'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminPayments = lazy(() => import('./pages/AdminPayments'))
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminBranding = lazy(() => import('./pages/AdminBranding'))
const AdminOrganizations = lazy(() => import('./pages/AdminOrganizations'))
const AdminPlans = lazy(() => import('./pages/AdminPlans'))
const AdminFeatures = lazy(() => import('./pages/AdminFeatures'))
const AdminRyanPackages = lazy(() => import('./pages/AdminRyanPackages'))
const AdminRoles = lazy(() => import('./pages/AdminRoles'))
const AdminTickets = lazy(() => import('./pages/AdminTickets'))
const Tickets = lazy(() => import('./pages/Tickets'))
const Search = lazy(() => import('./pages/Search'))
const Plans = lazy(() => import('./pages/Plans'))
import PaymentRequest from './pages/PaymentRequest'
const Tasks = lazy(() => import('./pages/Tasks'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Billing = lazy(() => import('./pages/Billing'))
const Reports = lazy(() => import('./pages/Reports'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))
const MetaConnections = lazy(() => import('./pages/MetaConnections'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function PublicShell() {
  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 text-ink-950 flex flex-col">
      <main className="flex-1"><Outlet /></main>
      <SiteFooter />
    </div>
  )
}

function PageLoading() {
  return <div dir="rtl" className="min-h-[40vh] flex items-center justify-center p-6"><div className="rounded-2xl border border-blue-100 bg-white/90 px-5 py-4 text-sm font-semibold text-ink-700 shadow-sm">جاري تحميل الصفحة...</div></div>
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
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/home" element={<Landing />} />
              <Route element={<PublicShell />}>
                <Route path="/login" element={<Login />} />
                <Route path="/confirm-signup" element={<ConfirmSignup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/support" element={<Support />} />
                <Route path="/refund-policy" element={<RefundPolicy />} />
              </Route>
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<FeatureRoute feature="dashboard" featureName="الرئيسية"><Dashboard /></FeatureRoute>} />
                <Route path="/crm" element={<PermissionRoute resource="customers"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><CRM /></FeatureRoute></PermissionRoute>} />
                <Route path="/leads" element={<PermissionRoute resource="customers"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><CRM /></FeatureRoute></PermissionRoute>} />
                <Route path="/crm/customer/:id" element={<PermissionRoute resource="customers"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><CustomerDetail /></FeatureRoute></PermissionRoute>} />
                <Route path="/pipeline" element={<PermissionRoute resource="deals"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><Pipeline /></FeatureRoute></PermissionRoute>} />
                <Route path="/pipeline/deal/:id" element={<PermissionRoute resource="deals"><FeatureRoute feature="crm" featureName="إدارة العملاء CRM"><DealDetail /></FeatureRoute></PermissionRoute>} />
                <Route path="/services" element={<PermissionRoute resource="services"><FeatureRoute feature="services" featureName="الخدمات"><Services /></FeatureRoute></PermissionRoute>} />
                <Route path="/campaigns" element={<PermissionRoute resource="campaigns"><FeatureRoute feature="campaigns" featureName="الحملات التسويقية"><Campaigns /></FeatureRoute></PermissionRoute>} />
                <Route path="/ai-content" element={<PermissionRoute resource="ai_content"><FeatureRoute feature="ai_content" featureName="استوديو المحتوى بالـAI"><AIContentStudio /></FeatureRoute></PermissionRoute>} />
                <Route path="/inbox" element={<PermissionRoute resource="inbox"><FeatureRoute feature="inbox" featureName="صندوق المحادثات"><Inbox /></FeatureRoute></PermissionRoute>} />
                <Route path="/ryan" element={<PermissionRoute resource="ryan"><FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanPageShell /></FeatureRoute></PermissionRoute>} />
                <Route path="/ryan/assistant" element={<PermissionRoute resource="ryan"><FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanAssistant /></FeatureRoute></PermissionRoute>} />
                <Route path="/ryan/settings" element={<PermissionRoute resource="settings"><FeatureRoute feature="ryan" featureName="Ryan الذكي"><RyanSettings /></FeatureRoute></PermissionRoute>} />
                <Route path="/ryan/knowledge" element={<PermissionRoute resource="knowledge_base"><FeatureRoute feature="ryan" featureName="Ryan الذكي"><KnowledgeBase /></FeatureRoute></PermissionRoute>} />
                <Route path="/ryan/handoff" element={<PermissionRoute resource="handoff"><FeatureRoute feature="ryan" featureName="Ryan الذكي"><HandoffRequests /></FeatureRoute></PermissionRoute>} />
                <Route path="/automations" element={<PermissionRoute resource="automations"><FeatureRoute feature="automations" featureName="الأتمتة"><Automations /></FeatureRoute></PermissionRoute>} />
                <Route path="/tickets" element={<PermissionRoute resource="tickets"><FeatureRoute feature="tickets" featureName="الدعم الفني"><Tickets /></FeatureRoute></PermissionRoute>} />
                <Route path="/search" element={<FeatureRoute feature="dashboard" featureName="البحث"><Search /></FeatureRoute>} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/billing/pay" element={<PaymentRequest />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/tasks" element={<PermissionRoute resource="tasks"><FeatureRoute feature="tasks" featureName="المهام والمتابعات"><Tasks /></FeatureRoute></PermissionRoute>} />
                <Route path="/appointments" element={<PermissionRoute resource="appointments"><FeatureRoute feature="appointments" featureName="المواعيد"><Appointments /></FeatureRoute></PermissionRoute>} />
                <Route path="/reports" element={<PermissionRoute resource="reports"><FeatureRoute feature="advanced_reports" featureName="التقارير المتقدمة"><Reports /></FeatureRoute></PermissionRoute>} />
                <Route path="/users" element={<PermissionRoute resource="users"><FeatureRoute feature="users" featureName="المستخدمون والصلاحيات"><Users /></FeatureRoute></PermissionRoute>} />
                <Route path="/account" element={<Account />} />
                <Route path="/settings" element={<PermissionRoute resource="settings"><FeatureRoute feature="settings" featureName="الإعدادات"><Settings /></FeatureRoute></PermissionRoute>} />
                <Route path="/integrations/meta" element={<PermissionRoute resource="integrations"><FeatureRoute feature="integrations" featureName="التكاملات"><MetaConnections /></FeatureRoute></PermissionRoute>} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/organizations" element={<AdminRoute><AdminOrganizations /></AdminRoute>} />
                <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
                <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />
                <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                <Route path="/admin/branding" element={<AdminRoute><AdminBranding /></AdminRoute>} />
                <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
                <Route path="/admin/features" element={<AdminRoute><AdminFeatures /></AdminRoute>} />
                <Route path="/admin/ryan-credits" element={<AdminRoute><AdminRyanPackages /></AdminRoute>} />
                <Route path="/admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
                <Route path="/admin/tickets" element={<AdminRoute><AdminTickets /></AdminRoute>} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
