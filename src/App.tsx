import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'

import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import FeatureRoute from './components/FeatureRoute'
import Layout from './components/Layout'

import Landing from './pages/Landing'
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
import Account from './pages/Account'
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
            {/* Public website */}
            <Route
              path="/home"
              element={<Landing />}
            />

            {/* Authentication */}
            <Route
              path="/login"
              element={<Login />}
            />

            {/* Legal / support */}
            <Route
              path="/privacy"
              element={<Privacy />}
            />

            <Route
              path="/terms"
              element={<Terms />}
            />

            <Route
              path="/support"
              element={<Support />}
            />

            {/* Protected application */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/"
                element={<Dashboard />}
              />

              <Route
                path="/crm"
                element={
                  <FeatureRoute
                    feature="crm"
                    featureName="إدارة العملاء CRM"
                  >
                    <CRM />
                  </FeatureRoute>
                }
              />

              <Route
                path="/crm/customer/:id"
                element={
                  <FeatureRoute
                    feature="crm"
                    featureName="إدارة العملاء CRM"
                  >
                    <CustomerDetail />
                  </FeatureRoute>
                }
              />

              <Route
                path="/pipeline"
                element={
                  <FeatureRoute
                    feature="crm"
                    featureName="إدارة العملاء CRM"
                  >
                    <Pipeline />
                  </FeatureRoute>
                }
              />

              <Route
                path="/pipeline/deal/:id"
                element={
                  <FeatureRoute
                    feature="crm"
                    featureName="إدارة العملاء CRM"
                  >
                    <DealDetail />
                  </FeatureRoute>
                }
              />

              <Route
                path="/services"
                element={<Services />}
              />

              <Route
                path="/campaigns"
                element={
                  <FeatureRoute
                    feature="campaigns"
                    featureName="الحملات التسويقية"
                  >
                    <Campaigns />
                  </FeatureRoute>
                }
              />

              <Route
                path="/inbox"
                element={<Inbox />}
              />

              <Route
                path="/ryan"
                element={
                  <FeatureRoute
                    feature="ryan"
                    featureName="Ryan الذكي"
                  >
                    <Ryan />
                  </FeatureRoute>
                }
              />

              <Route
                path="/ryan/knowledge"
                element={
                  <FeatureRoute
                    feature="ryan"
                    featureName="Ryan الذكي"
                  >
                    <KnowledgeBase />
                  </FeatureRoute>
                }
              />

              <Route
                path="/ryan/handoff"
                element={
                  <FeatureRoute
                    feature="ryan"
                    featureName="Ryan الذكي"
                  >
                    <HandoffRequests />
                  </FeatureRoute>
                }
              />

              <Route
                path="/automations"
                element={
                  <FeatureRoute
                    feature="automations"
                    featureName="الأتمتة"
                  >
                    <Automations />
                  </FeatureRoute>
                }
              />

              <Route
                path="/tickets"
                element={<Tickets />}
              />

              <Route
                path="/search"
                element={<Search />}
              />

              <Route
                path="/plans"
                element={<Plans />}
              />

              <Route
                path="/billing/pay"
                element={<PaymentRequest />}
              />

              <Route
                path="/tasks"
                element={<Tasks />}
              />

              <Route
                path="/appointments"
                element={<Appointments />}
              />

              <Route
                path="/billing"
                element={<Billing />}
              />

              <Route
                path="/reports"
                element={
                  <FeatureRoute
                    feature="advanced_reports"
                    featureName="التقارير المتقدمة"
                  >
                    <Reports />
                  </FeatureRoute>
                }
              />

              <Route
                path="/users"
                element={<Users />}
              />

              <Route
                path="/account"
                element={<Account />}
              />

              <Route
                path="/settings"
                element={<Settings />}
              />

              {/* Admin */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/organizations"
                element={
                  <AdminRoute>
                    <AdminOrganizations />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/payments"
                element={
                  <AdminRoute>
                    <AdminPayments />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/audit-logs"
                element={
                  <AdminRoute>
                    <AdminAuditLogs />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/settings"
                element={
                  <AdminRoute>
                    <AdminSettings />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/branding"
                element={
                  <AdminRoute>
                    <AdminBranding />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/plans"
                element={
                  <AdminRoute>
                    <AdminPlans />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/ryan-credits"
                element={
                  <AdminRoute>
                    <AdminRyanCredits />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/roles"
                element={
                  <AdminRoute>
                    <AdminRoles />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/tickets"
                element={
                  <AdminRoute>
                    <AdminTickets />
                  </AdminRoute>
                }
              />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
