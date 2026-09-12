import React, { useEffect, useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconPlus } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface DBService {
  id: string
  name: string
  description: string | null
  category: string | null
  price: string | null
}

const emptyForm = {
  name: '',
  description: '',
  category: '',
  price: '',
}

const IconBriefcase = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <rect x="4" y="7" width="16" height="13" rx="2" />
    <path
      d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12h16M10 12v2h4v-2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconSearch = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m16 16 4 4" strokeLinecap="round" />
  </svg>
)

const IconRefresh = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const IconX = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={className}
    aria-hidden="true"
  >
    <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
  </svg>
)

const IconTag = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 5.5A1.5 1.5 0 0 1 5.5 4h6.1a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0l-6.4-6.4A2 2 0 0 1 4 11.6V5.5Z"
      strokeLinejoin="round"
    />
    <circle cx="8.2" cy="8.2" r="1.2" />
  </svg>
)

const IconMoney = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <rect x="3.5" y="6" width="17" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M7 9.5h.01M17 14.5h.01" strokeLinecap="round" />
  </svg>
)

const IconFile = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
      strokeLinejoin="round"
    />
    <path d="M14 3.5V8h4M9 12h6M9 15.5h5" strokeLinecap="round" />
  </svg>
)

const IconAlert = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M10.3 4.8 3.9 16a2 2 0 0 0 1.7 3h12.8a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z"
      strokeLinejoin="round"
    />
    <path d="M12 9v4M12 16.5h.01" strokeLinecap="round" />
  </svg>
)

const SkeletonCard = () => (
  <Card className="overflow-hidden p-0">
    <div className="animate-pulse p-5">
      <div className="h-5 w-24 rounded-lg bg-sand-100" />
      <div className="mt-4 h-5 w-3/4 rounded-lg bg-sand-100" />
      <div className="mt-3 h-4 w-full rounded-lg bg-sand-100" />
      <div className="mt-2 h-4 w-2/3 rounded-lg bg-sand-100" />
      <div className="mt-6 h-px bg-sand-100" />
      <div className="mt-4 h-4 w-28 rounded-lg bg-sand-100" />
    </div>
  </Card>
)

export default function Services() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization()

  const [services, setServices] = useState<DBService[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')

  const loadData = async () => {
    if (!supabase || !organizationId) return

    setLoading(true)
    setLoadError(null)

    const { data, error: queryError } = await supabase
      .from('services')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (queryError) {
      console.error('Services load error:', queryError)
      setLoadError(queryError.message)
      setServices([])
      setLoading(false)
      return
    }

    if (data) {
      setServices(data as DBService[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (organizationId) {
      loadData()
    }
  }, [organizationId])

  const filteredServices = services.filter((service) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    return [
      service.name,
      service.description,
      service.category,
      service.price,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !organizationId) return

    const name = form.name.trim()

    if (!name) {
      setError('اكتب اسم الخدمة أولًا.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase
      .from('services')
      .insert({
        organization_id: organizationId,
        name,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        price: form.price.trim() || null,
      })

    setSaving(false)

    if (insertError) {
      console.error('Service insert error:', insertError)
      setError(insertError.message)
      return
    }

    setForm(emptyForm)
    setShowForm(false)
    await loadData()
  }

  const closeForm = () => {
    if (saving) return

    setShowForm(false)
    setError(null)
    setForm(emptyForm)
  }

  if (!supabase) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <Card className="border-red-100 bg-red-50/70 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            <IconAlert className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-red-800">
            قاعدة البيانات غير متصلة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/70">
            تأكد من إعداد اتصال Supabase في بيئة التشغيل.
          </p>
        </Card>
      </div>
    )
  }

  if (orgLoading) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded bg-sand-100" />
          <div className="mt-4 h-8 w-52 rounded-lg bg-sand-100" />
          <div className="mt-3 h-4 w-80 max-w-full rounded bg-sand-100" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (orgError || !organizationId) {
    return (
      <div dir="rtl" className="py-16">
        <Card className="mx-auto max-w-lg border-red-100 bg-red-50/70 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            <IconAlert className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-red-800">
            تعذر تحديد المؤسسة
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-700/70">
            {orgError ?? 'تعذر تحديد المؤسسة الخاصة بحسابك.'}
          </p>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-pulse">
            <div className="h-4 w-20 rounded bg-sand-100" />
            <div className="mt-4 h-8 w-48 rounded-lg bg-sand-100" />
            <div className="mt-3 h-4 w-72 max-w-full rounded bg-sand-100" />
          </div>

          <div className="h-11 w-32 animate-pulse rounded-xl bg-sand-100" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div dir="rtl" className="space-y-6 pb-8">
        <div>
          <div className="text-xs font-bold text-gold-600">
            الخدمات
          </div>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-950">
            الخدمات والمنتجات
          </h1>
        </div>

        <Card className="border-red-100 bg-red-50/70 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            <IconAlert className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-lg font-extrabold text-red-800">
            تعذر تحميل الخدمات
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700/70">
            {loadError}
          </p>

          <Button
            type="button"
            variant="secondary"
            onClick={loadData}
            className="mt-5"
          >
            <span className="inline-flex items-center gap-2">
              <IconRefresh className="h-4 w-4" />
              إعادة المحاولة
            </span>
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-sand-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-50 px-3 py-1.5 text-[10px] font-extrabold text-gold-700">
              <IconBriefcase className="h-3.5 w-3.5" />
              كتالوج الخدمات
            </div>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">
              الخدمات والمنتجات
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/50">
              أنشئ كتالوجًا منظمًا لخدمات ومنتجات شركتك واستخدمه لاحقًا داخل العملاء والصفقات والحملات.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-sm font-bold text-ink-900/60">
              <span className="text-lg font-extrabold text-ink-950">
                {services.length.toLocaleString('ar-EG')}
              </span>
              <span>خدمة</span>
            </div>

            <Button
              type="button"
              onClick={() => {
                setShowForm((value) => !value)
                setError(null)
              }}
              aria-expanded={showForm}
              className="min-h-11"
            >
              <span className="inline-flex items-center gap-2">
                {showForm ? (
                  <IconX className="h-4 w-4" />
                ) : (
                  <IconPlus className="h-4 w-4" />
                )}

                {showForm ? 'إغلاق النموذج' : 'إضافة خدمة'}
              </span>
            </Button>
          </div>
        </div>
      </section>

      {showForm && (
        <Card className="overflow-hidden border-sand-200/80 p-0 shadow-sm">
          <div className="border-b border-sand-100 bg-sand-50/60 px-5 py-4 sm:px-6">
            <div className="text-xs font-bold text-gold-600">
              خدمة جديدة
            </div>

            <h2 className="mt-1 text-base font-extrabold text-ink-950">
              إضافة خدمة أو منتج
            </h2>

            <p className="mt-1 text-xs text-ink-900/45">
              أضف البيانات الأساسية التي ستظهر داخل الكتالوج.
            </p>
          </div>

          <form
            onSubmit={handleAdd}
            className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="service-name"
                className="mb-2 block text-xs font-bold text-ink-900/65"
              >
                اسم الخدمة
              </label>

              <input
                id="service-name"
                required
                autoFocus
                placeholder="مثال: إدارة الحملات الإعلانية"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                disabled={saving}
                className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
              />
            </div>

            <div>
              <label
                htmlFor="service-category"
                className="mb-2 block text-xs font-bold text-ink-900/65"
              >
                التصنيف
              </label>

              <input
                id="service-category"
                placeholder="مثال: تسويق"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
                disabled={saving}
                className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
              />
            </div>

            <div>
              <label
                htmlFor="service-price"
                className="mb-2 block text-xs font-bold text-ink-900/65"
              >
                السعر
              </label>

              <input
                id="service-price"
                placeholder="مثال: 5000 ج.م / شهريًا"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: e.target.value,
                  })
                }
                disabled={saving}
                className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="service-description"
                className="mb-2 block text-xs font-bold text-ink-900/65"
              >
                الوصف
              </label>

              <textarea
                id="service-description"
                placeholder="وصف مختصر للخدمة أو المنتج..."
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                disabled={saving}
                rows={4}
                className="w-full resize-none rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm leading-6 text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 sm:col-span-2"
              >
                <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={closeForm}
                disabled={saving}
                className="min-h-11"
              >
                إلغاء
              </Button>

              <Button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="min-h-11"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الخدمة'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {services.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-900/30" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الخدمات..."
              aria-label="البحث في الخدمات"
              className="w-full rounded-xl border border-sand-200 bg-white py-3 pe-11 ps-10 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-900/35 transition hover:bg-sand-100 hover:text-ink-950"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>

          {search && (
            <div className="flex items-center rounded-xl border border-sand-200 bg-white px-4 py-3 text-xs font-bold text-ink-900/50">
              {filteredServices.length.toLocaleString('ar-EG')} نتيجة
            </div>
          )}
        </div>
      )}

      {services.length === 0 ? (
        <Card className="border-sand-200/80 p-8 text-center shadow-sm sm:p-14">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/45">
            <IconBriefcase className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-lg font-extrabold text-ink-950">
            لم تضف أي خدمات بعد
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/45">
            ابدأ بإضافة أول خدمة أو منتج لشركتك ليظهر هنا داخل الكتالوج.
          </p>

          <Button
            type="button"
            onClick={() => {
              setShowForm(true)
              setError(null)
            }}
            className="mt-5"
          >
            <span className="inline-flex items-center gap-2">
              <IconPlus className="h-4 w-4" />
              إضافة أول خدمة
            </span>
          </Button>
        </Card>
      ) : filteredServices.length === 0 ? (
        <Card className="border-sand-200/80 p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/45">
            <IconSearch className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-base font-extrabold text-ink-950">
            لا توجد نتائج
          </h2>

          <p className="mt-2 text-sm text-ink-900/45">
            جرّب البحث باسم مختلف أو امسح كلمة البحث.
          </p>

          <button
            type="button"
            onClick={() => setSearch('')}
            className="mt-4 text-sm font-bold text-gold-700 transition hover:text-gold-800"
          >
            مسح البحث
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className="group flex min-h-[230px] flex-col overflow-hidden border-sand-200/80 p-0 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-white transition group-hover:bg-ink-800">
                    <IconBriefcase className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words text-base font-extrabold leading-6 text-ink-950">
                      {service.name}
                    </h3>

                    {service.category && (
                      <div className="mt-2">
                        <Badge>
                          <span className="inline-flex items-center gap-1.5">
                            <IconTag className="h-3 w-3" />
                            {service.category}
                          </span>
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col px-5 pb-5">
                {service.description ? (
                  <p className="text-sm leading-6 text-ink-900/50">
                    {service.description}
                  </p>
                ) : (
                  <p className="text-sm italic leading-6 text-ink-900/25">
                    لا يوجد وصف مضاف لهذه الخدمة.
                  </p>
                )}

                <div className="mt-auto pt-5">
                  <div className="h-px bg-sand-100" />

                  {service.price ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-900/40">
                        <IconMoney className="h-4 w-4" />
                        السعر
                      </span>

                      <span className="max-w-[65%] break-words text-left text-sm font-extrabold text-gold-700">
                        {service.price}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink-900/30">
                      <IconFile className="h-4 w-4" />
                      لم يتم تحديد سعر
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
