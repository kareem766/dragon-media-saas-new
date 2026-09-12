import React, { useEffect, useState } from ‘react’
import { Card, Badge, Button, Table, statusTone } from ‘../components/ui’
import { IconPlus } from ‘../components/Icon’
import { supabase } from ‘../lib/supabaseClient’
import { useOrganization } from ‘../lib/useOrganization’

interface DBAppointment {
id: string
appointment_date: string | null
appointment_time: string | null
status: string
notes: string | null
customers: { name: string } | null
services: { name: string } | null
}

interface Option {
id: string
name: string
}

const emptyForm = {
customerId: ‘’,
serviceId: ‘’,
date: ‘’,
time: ‘’,
}

function CalendarIcon() {
return (
)
}

function ClockIcon() {
return (
)
}

function UserIcon() {
return (
)
}

function ServiceIcon() {
return (
)
}

function SkeletonRow() {
return (
)
}

export default function Appointments() {
const {
organizationId,
loading: orgLoading,
error: orgError,
} = useOrganization()

const [appointments, setAppointments] = useState<DBAppointment[]>([])
const [customers, setCustomers] = useState<Option[]>([])
const [services, setServices] = useState<Option[]>([])
const [loading, setLoading] = useState(true)
const [showForm, setShowForm] = useState(false)
const [saving, setSaving] = useState(false)
const [error, setError] = useState<string | null>(null)
const [form, setForm] = useState(emptyForm)

const loadData = async () => {
if (!supabase || !organizationId) return

setLoading(true)
const [apRes, custRes, servRes] = await Promise.all([
  supabase
    .from('appointments')
    .select('*, customers(name), services(name)')
    .eq('organization_id', organizationId)
    .order('appointment_date', { ascending: true }),
  supabase
    .from('customers')
    .select('id, name')
    .eq('organization_id', organizationId),
  supabase
    .from('services')
    .select('id, name')
    .eq('organization_id', organizationId),
])
if (apRes.data) {
  setAppointments(apRes.data as unknown as DBAppointment[])
}
if (custRes.data) {
  setCustomers(custRes.data as Option[])
}
if (servRes.data) {
  setServices(servRes.data as Option[])
}
setLoading(false)

}

useEffect(() => {
if (organizationId) {
loadData()
}
}, [organizationId])

const handleAdd = async (e: React.FormEvent) => {
e.preventDefault()

if (!supabase || !organizationId) return
setSaving(true)
setError(null)
const { error } = await supabase.from('appointments').insert({
  organization_id: organizationId,
  customer_id: form.customerId || null,
  service_id: form.serviceId || null,
  appointment_date: form.date || null,
  appointment_time: form.time || null,
  status: 'قيد الانتظار',
})
setSaving(false)
if (error) {
  setError(error.message)
  return
}
setForm(emptyForm)
setShowForm(false)
await loadData()

}

if (orgLoading || loading) {
return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
      <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
      <div className="h-24 animate-pulse rounded-2xl border border-sand-200/70 bg-white" />
    </div>
    <Card className="overflow-hidden p-0">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </Card>
  </div>
)

}

if (orgError || !organizationId) {
return (
      <h2 className="mt-4 text-base font-bold text-red-900">
        تعذر تحميل بيانات المؤسسة
      </h2>
      <p className="mt-2 text-sm leading-6 text-red-700/80">
        {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك'}
      </p>
    </Card>
  </div>
)

}

const pendingCount = appointments.filter(
(appointment) => appointment.status === ‘قيد الانتظار’
).length

return (
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-ink-900/60">
                إدارة المواعيد
              </span>
              {appointments.length > 0 && (
                <Badge tone={pendingCount > 0 ? 'success' : 'default'}>
                  {pendingCount > 0
                    ? `${pendingCount} قيد الانتظار`
                    : 'لا توجد مواعيد معلّقة'}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              المواعيد
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/55">
              نظّم مواعيد العملاء والخدمات في مكان واحد وتابع الحجوزات بسهولة.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => {
            setShowForm((value) => !value)
            setError(null)
          }}
          aria-expanded={showForm}
          className="w-full shrink-0 sm:w-auto"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <IconPlus className="h-4 w-4" />
            {showForm ? 'إخفاء النموذج' : 'حجز موعد'}
          </span>
        </Button>
      </div>
    </div>
  </section>
  <section
    aria-label="ملخص المواعيد"
    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
  >
    <Card className="border-sand-200/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-900/45">
            إجمالي المواعيد
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
            {appointments.length}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
          <CalendarIcon />
        </div>
      </div>
    </Card>
    <Card className="border-sand-200/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-900/45">
            قيد الانتظار
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
            {pendingCount}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <ClockIcon />
        </div>
      </div>
    </Card>
    <Card className="border-sand-200/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-900/45">
            العملاء المتاحون
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
            {customers.length}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
          <UserIcon />
        </div>
      </div>
    </Card>
  </section>
  {showForm && (
    <Card className="overflow-hidden border-sand-200/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
      <div className="border-b border-sand-200/70 bg-sand-50/45 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-white">
            <CalendarIcon />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-950 sm:text-base">
              حجز موعد جديد
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-900/50">
              اختر العميل والخدمة وحدد موعد الحجز.
            </p>
          </div>
        </div>
      </div>
      <form onSubmit={handleAdd} className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="appointment-customer"
              className="mb-1.5 block text-xs font-semibold text-ink-900/65"
            >
              العميل
            </label>
            <div className="relative">
              <select
                id="appointment-customer"
                value={form.customerId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    customerId: e.target.value,
                  })
                }
                className="w-full appearance-none rounded-xl border border-sand-200 bg-white px-3.5 py-3 pr-10 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
              >
                <option value="">اختر العميل</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <UserIcon />
            </div>
          </div>
          <div>
            <label
              htmlFor="appointment-service"
              className="mb-1.5 block text-xs font-semibold text-ink-900/65"
            >
              الخدمة
            </label>
            <div className="relative">
              <select
                id="appointment-service"
                value={form.serviceId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    serviceId: e.target.value,
                  })
                }
                className="w-full appearance-none rounded-xl border border-sand-200 bg-white px-3.5 py-3 pr-10 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
              >
                <option value="">اختر الخدمة</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <ServiceIcon />
            </div>
          </div>
          <div>
            <label
              htmlFor="appointment-date"
              className="mb-1.5 block text-xs font-semibold text-ink-900/65"
            >
              التاريخ
            </label>
            <input
              id="appointment-date"
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm({
                  ...form,
                  date: e.target.value,
                })
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
            />
          </div>
          <div>
            <label
              htmlFor="appointment-time"
              className="mb-1.5 block text-xs font-semibold text-ink-900/65"
            >
              الوقت
            </label>
            <input
              id="appointment-time"
              type="time"
              value={form.time}
              onChange={(e) =>
                setForm({
                  ...form,
                  time: e.target.value,
                })
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
            />
          </div>
          {error && (
            <div
              role="alert"
              className="sm:col-span-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-sand-200/70 pt-5 sm:flex-row">
          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                جاري الحفظ...
              </span>
            ) : (
              'حفظ الموعد'
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setForm(emptyForm)
              setError(null)
              setShowForm(false)
            }}
            className="w-full sm:w-auto"
          >
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  )}
  <section aria-labelledby="appointments-list-title">
    <div className="mb-3">
      <h2
        id="appointments-list-title"
        className="text-base font-bold text-ink-950"
      >
        المواعيد الحالية
      </h2>
      <p className="mt-1 text-xs text-ink-900/45">
        جميع الحجوزات المرتبطة بمساحة العمل الحالية.
      </p>
    </div>
    {appointments.length === 0 ? (
      <Card className="border-dashed border-sand-300 bg-white p-8 sm:p-12">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900">
            <CalendarIcon />
          </div>
          <h3 className="mt-4 text-base font-bold text-ink-950">
            لا توجد مواعيد بعد
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-900/45">
            ابدأ بإضافة أول موعد للعميل حتى تظهر الحجوزات هنا.
          </p>
          <div className="mt-5">
            <Button
              type="button"
              onClick={() => {
                setError(null)
                setShowForm(true)
              }}
            >
              <span className="inline-flex items-center gap-2">
                <IconPlus className="h-4 w-4" />
                حجز أول موعد
              </span>
            </Button>
          </div>
        </div>
      </Card>
    ) : (
      <Card className="overflow-hidden border-sand-200/80 p-0 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="divide-y divide-sand-200/60 sm:hidden">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
                    <CalendarIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-950">
                      {appointment.customers?.name ?? 'عميل غير محدد'}
                    </p>
                    <p className="mt-1 truncate text-xs text-ink-900/50">
                      {appointment.services?.name ?? 'خدمة غير محددة'}
                    </p>
                  </div>
                </div>
                <Badge tone={statusTone(appointment.status)}>
                  {appointment.status}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-sand-50 px-3 py-2.5">
                  <p className="text-[11px] text-ink-900/40">التاريخ</p>
                  <p className="mt-1 text-xs font-semibold text-ink-900/75">
                    {appointment.appointment_date ?? 'غير محدد'}
                  </p>
                </div>
                <div className="rounded-xl bg-sand-50 px-3 py-2.5">
                  <p className="text-[11px] text-ink-900/40">الوقت</p>
                  <p className="mt-1 text-xs font-semibold text-ink-900/75">
                    {appointment.appointment_time ?? 'غير محدد'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <Table head={['العميل', 'الخدمة', 'التاريخ', 'الوقت', 'الحالة']}>
            {appointments.map((appointment) => (
              <tr
                key={appointment.id}
                className="border-b border-sand-200/60 transition last:border-0 hover:bg-sand-50/70"
              >
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 text-ink-900">
                      <UserIcon />
                    </div>
                    <span className="font-semibold text-ink-950">
                      {appointment.customers?.name ?? '—'}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-sm text-ink-900/70">
                  {appointment.services?.name ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-sm text-ink-900/70">
                  {appointment.appointment_date ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-sm text-ink-900/70">
                  {appointment.appointment_time ?? '—'}
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone={statusTone(appointment.status)}>
                    {appointment.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
    )}
  </section>
</div>

)
}
