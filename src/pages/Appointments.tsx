import React, { useEffect, useState } from 'react'
import { Card, Badge, Button, Table, statusTone } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

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
  customerId: '',
  serviceId: '',
  date: '',
  time: '',
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path strokeLinecap="round" d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
      <path
        strokeLinecap="round"
        d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5v5l3.25 2"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5"
      />
    </svg>
  )
}

function SkeletonRow() {
  return (
    <div className="animate-pulse border-b border-sand-200/60 px-4 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-sand-100" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-36 rounded bg-sand-100" />
          <div className="h-3 w-56 max-w-full rounded bg-sand-100" />
        </div>

        <div className="hidden h-7 w-20 rounded-full bg-sand-100 sm:block" />
      </div>
    </div>
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
    setError(null)

    const [appointmentsResponse, customersResponse, servicesResponse] =
      await Promise.all([
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

    if (appointmentsResponse.error) {
      setError(appointmentsResponse.error.message)
    } else if (appointmentsResponse.data) {
      setAppointments(
        appointmentsResponse.data as unknown as DBAppointment[]
      )
    }

    if (customersResponse.data) {
      setCustomers(customersResponse.data as Option[])
    }

    if (servicesResponse.data) {
      setServices(servicesResponse.data as Option[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabase || !organizationId) return

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('appointments')
      .insert({
        organization_id: organizationId,
        customer_id: form.customerId || null,
        service_id: form.serviceId || null,
        appointment_date: form.date || null,
        appointment_time: form.time || null,
        status: 'قيد الانتظار',
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(emptyForm)
    setShowForm(false)

    await loadData()
  }

  if (orgLoading || loading) {
    return (
      <div
        dir="rtl"
        className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
      >
        <div className="animate-pulse">
          <div className="h-8 w-40 rounded-lg bg-sand-100" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-sand-100" />
        </div>

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
      <div
        dir="rtl"
        className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-12"
      >
        <Card className="w-full border-red-100 bg-red-50/60 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M10.3 3.8 2.9 17a2 2 0 0 0 1.74 3h14.72a2 2 0 0 0 1.74-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
              />
            </svg>
          </div>

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
    (appointment) => appointment.status === 'قيد الانتظار'
  ).length

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
    >
      <section className="overflow-hidden rounded-3xl border border-sand-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="relative p-5 sm:p-7">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-white shadow-sm">
                <CalendarIcon />
              </div>

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
                  نظّم مواعيد العملاء والخدمات في مكان واحد وتابع الحجوزات
                  بسهولة.
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

                <select
                  id="appointment-customer"
                  value={form.customerId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customerId: event.target.value,
                    })
                  }
                  className="w-full appearance-none rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
                >
                  <option value="">اختر العميل</option>

                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="appointment-service"
                  className="mb-1.5 block text-xs font-semibold text-ink-900/65"
                >
                  الخدمة
                </label>

                <select
                  id="appointment-service"
                  value={form.serviceId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      serviceId: event.target.value,
                    })
                  }
                  className="w-full appearance-none rounded-xl border border-sand-200 bg-white px-3.5 py-3 text-sm text-ink-950 outline-none transition focus:border-ink-700 focus:ring-4 focus:ring-ink-950/5"
                >
                  <option value="">اختر الخدمة</option>

                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
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
                  onChange={(event) =>
                    setForm({
                      ...form,
                      date: event.target.value,
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
                  onChange={(event) =>
                    setForm({
                      ...form,
                      time: event.target.value,
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
              <Table
                head={['العميل', 'الخدمة', 'التاريخ', 'الوقت', 'الحالة']}
              >
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
