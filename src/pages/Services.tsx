import React, { useEffect, useMemo, useState } from ‘react’
import { Card, Badge, Button, Skeleton } from ‘../components/ui’
import { IconPlus } from ‘../components/Icon’
import { supabase } from ‘../lib/supabaseClient’
import { useOrganization } from ‘../lib/useOrganization’

interface DBService {
id: string
name: string
description: string | null
category: string | null
price: string | null
}

const IconBriefcase = ({ className = ‘’ }: { className?: string }) => (
<svg
viewBox=“0 0 24 24”
fill=“none”
stroke=“currentColor”
strokeWidth=“1.7”
className={className}
aria-hidden=“true”

<rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
<path
  d="M8.5 7V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V7M3.5 11h17M10 12.5h4v2h-4z"
  strokeLinecap="round"
  strokeLinejoin="round"
/>
  </svg>
)

const IconRefresh = ({ className = ‘’ }: { className?: string }) => (
<svg
viewBox=“0 0 24 24”
fill=“none”
stroke=“currentColor”
strokeWidth=“1.8”
className={className}
aria-hidden=“true”

<path
  d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
  strokeLinecap="round"
  strokeLinejoin="round"
/>
  </svg>
)

const IconX = ({ className = ‘’ }: { className?: string }) => (
<svg
viewBox=“0 0 24 24”
fill=“none”
stroke=“currentColor”
strokeWidth=“1.8”
className={className}
aria-hidden=“true”

<path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
)

const formatServiceCount = (count: number) =>
new Intl.NumberFormat(‘ar-EG’).format(count)

export default function Services() {
const {
organizationId,
loading: orgLoading,
error: orgError,
} = useOrganization()

const [services, setServices] = useState<DBService[]>([])
const [loading, setLoading] = useState(true)
const [showForm, setShowForm] = useState(false)
const [saving, setSaving] = useState(false)

const [error, setError] = useState<string | null>(null)
const [loadError, setLoadError] = useState<string | null>(null)

const [form, setForm] = useState({
name: ‘’,
description: ‘’,
category: ‘’,
price: ‘’,
})

const categoriesCount = useMemo(() => {
const categories = new Set(
services
.map((service) => service.category?.trim())
.filter(Boolean)
)

return categories.size

}, [services])

const loadData = async () => {
if (!supabase || !organizationId) return

setLoading(true)
setLoadError(null)
try {
  const { data, error: fetchError } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })
  if (fetchError) {
    throw fetchError
  }
  setServices((data || []) as DBService[])
} catch (err) {
  console.error('Services load error:', err)
  setServices([])
  setLoadError(
    err instanceof Error
      ? err.message
      : 'تعذر تحميل الخدمات الخاصة بمؤسستك.'
  )
} finally {
  setLoading(false)
}

}

useEffect(() => {
if (organizationId) {
loadData()
}
}, [organizationId])

const handleAdd = async (e: React.FormEvent) => {
e.preventDefault()

if (!supabase || !organizationId) return
const name = form.name.trim()
if (!name) {
  setError('من فضلك أدخل اسم الخدمة.')
  return
}
setSaving(true)
setError(null)
try {
  const { error: insertError } = await supabase
    .from('services')
    .insert({
      organization_id: organizationId,
      name,
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      price: form.price.trim() || null,
    })
  if (insertError) {
    throw insertError
  }
  setForm({
    name: '',
    description: '',
    category: '',
    price: '',
  })
  setShowForm(false)
  await loadData()
} catch (err) {
  console.error('Service create error:', err)
  setError(
    err instanceof Error
      ? err.message
      : 'تعذر حفظ الخدمة. حاول مرة أخرى.'
  )
} finally {
  setSaving(false)
}

}

const handleCloseForm = () => {
if (saving) return

setShowForm(false)
setError(null)

}

if (!supabase) {
return (
!
      <h2 className="mt-4 text-lg font-extrabold text-red-800">
        قاعدة البيانات غير متصلة
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700/70">
        تأكد من إعداد اتصال Supabase في بيئة التشغيل.
      </p>
    </Card>
  </div>
)

}

if (orgLoading || loading) {
return (
      <Skeleton className="h-11 w-full sm:w-32" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      {[1, 2].map((item) => (
        <Card key={item} className="p-5">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <Skeleton className="mt-5 h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </Card>
      ))}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="p-5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="mt-4 h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </Card>
      ))}
    </div>
  </div>
)

}

if (orgError || !organizationId) {
return (
!
      <h2 className="mt-4 text-lg font-extrabold text-red-800">
        تعذر تحديد المؤسسة
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700/70">
        {orgError || 'تعذر تحديد المؤسسة الخاصة بحسابك.'}
      </p>
    </Card>
  </div>
)

}

if (loadError) {
return (
إدارة الخدمات
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-950">
        الخدمات
      </h1>
    </div>
    <Card className="border-red-100 bg-red-50/60 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
        !
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
{/* Header */}
    <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold text-gold-600">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
          إدارة الخدمات
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">
          الخدمات والمنتجات
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/45">
          أضف الخدمات أو المنتجات التي تقدمها شركتك لاستخدامها داخل عمليات
          البيع وإدارة العملاء.
        </p>
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
  {/* Stats */}
  <div className="grid gap-4 sm:grid-cols-2">
    <Card className="group relative overflow-hidden border-sand-200/80 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-gold-400/10 blur-2xl transition group-hover:bg-gold-400/15" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-600">
          <IconBriefcase className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-ink-900/40">
            إجمالي الخدمات
          </div>
          <div className="mt-1 text-2xl font-extrabold text-ink-950">
            {formatServiceCount(services.length)}
          </div>
        </div>
      </div>
    </Card>
    <Card className="group relative overflow-hidden border-sand-200/80 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-ink-900/5 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/65">
          <span className="text-base font-extrabold">
            {formatServiceCount(categoriesCount)}
          </span>
        </div>
        <div>
          <div className="text-xs font-medium text-ink-900/40">
            التصنيفات المستخدمة
          </div>
          <div className="mt-1 text-sm font-extrabold text-ink-950">
            {categoriesCount === 0
              ? 'لا توجد تصنيفات بعد'
              : `${formatServiceCount(categoriesCount)} تصنيف`}
          </div>
        </div>
      </div>
    </Card>
  </div>
  {/* Add form */}
  {showForm && (
    <Card className="overflow-hidden border-sand-200/80 p-0 shadow-sm">
      <div className="border-b border-sand-100 bg-sand-50/60 px-5 py-4 sm:px-6">
        <div className="text-xs font-bold text-gold-600">
          خدمة جديدة
        </div>
        <h2 className="mt-1 text-lg font-extrabold text-ink-950">
          إضافة خدمة أو منتج
        </h2>
        <p className="mt-1 text-xs leading-5 text-ink-900/40">
          البيانات التي تضيفها هنا ستكون مرتبطة بمؤسستك الحالية.
        </p>
      </div>
      <form
        onSubmit={handleAdd}
        className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="service-name"
            className="mb-2 block text-xs font-bold text-ink-900/60"
          >
            اسم الخدمة
          </label>
          <input
            id="service-name"
            required
            autoComplete="off"
            placeholder="مثال: إدارة الحملات الإعلانية"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            disabled={saving}
            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
        </div>
        <div>
          <label
            htmlFor="service-category"
            className="mb-2 block text-xs font-bold text-ink-900/60"
          >
            التصنيف
          </label>
          <input
            id="service-category"
            autoComplete="off"
            placeholder="مثال: تسويق"
            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value,
              })
            }
            disabled={saving}
            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
        </div>
        <div>
          <label
            htmlFor="service-price"
            className="mb-2 block text-xs font-bold text-ink-900/60"
          >
            السعر
          </label>
          <input
            id="service-price"
            autoComplete="off"
            placeholder="مثال: 5000 ج.م"
            value={form.price}
            onChange={(e) =>
              setForm({
                ...form,
                price: e.target.value,
              })
            }
            disabled={saving}
            className="w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="service-description"
            className="mb-2 block text-xs font-bold text-ink-900/60"
          >
            الوصف
          </label>
          <textarea
            id="service-description"
            placeholder="اكتب وصفًا مختصرًا للخدمة..."
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            disabled={saving}
            rows={4}
            className="w-full resize-none rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm leading-6 text-ink-950 outline-none transition placeholder:text-ink-900/25 focus:border-ink-700 focus:ring-4 focus:ring-ink-900/5 disabled:cursor-not-allowed disabled:bg-sand-50"
          />
        </div>
        {error && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {error}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row">
          <Button
            type="submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الخدمة'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={handleCloseForm}
          >
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  )}
  {/* Empty state */}
  {services.length === 0 ? (
    <Card className="border-dashed border-sand-300 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand-100 text-ink-900/55">
        <IconBriefcase className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-extrabold text-ink-950">
        لا توجد خدمات مضافة بعد
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/45">
        أضف أول خدمة أو منتج لشركتك حتى يظهر هنا ويمكن استخدامه ضمن
        عمليات البيع وإدارة العملاء.
      </p>
      {!showForm && (
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
      )}
    </Card>
  ) : (
    /* Services grid */
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <Card
          key={service.id}
          className="group relative flex min-h-[190px] flex-col overflow-hidden border-sand-200/80 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-md sm:p-6"
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-gold-400/5 blur-2xl transition group-hover:bg-gold-400/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-900/60">
              <IconBriefcase className="h-5 w-5" />
            </div>
            {service.category && (
              <Badge>
                {service.category}
              </Badge>
            )}
          </div>
          <div className="relative mt-5">
            <h3 className="break-words text-base font-extrabold text-ink-950">
              {service.name}
            </h3>
            {service.description ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-900/50">
                {service.description}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-900/25">
                لا يوجد وصف مضاف لهذه الخدمة.
              </p>
            )}
          </div>
          <div className="relative mt-auto pt-5">
            {service.price ? (
              <div className="border-t border-sand-100 pt-4">
                <div className="text-[10px] font-bold text-ink-900/35">
                  السعر
                </div>
                <div className="mt-1 break-words text-sm font-extrabold text-gold-600">
                  {service.price}
                </div>
              </div>
            ) : (
              <div className="border-t border-sand-100 pt-4 text-xs font-medium text-ink-900/30">
                السعر غير محدد
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )}
</div>

)
}
