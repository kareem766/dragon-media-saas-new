import React, { useState } from 'react'
import { Card, Badge, Button } from '../components/ui'
import { IconSearch } from '../components/Icon'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

interface Result {
  id: string
  label: string
  sub: string
  href: string
  type: string
}

export default function Search() {
  const { organizationId } = useOrganization()

  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runSearch = async (query: string) => {
    setQ(query)
    setError('')

    const cleanQuery = query.trim()

    if (!supabase || !organizationId || cleanQuery.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const term = `%${cleanQuery}%`

      const [custRes, leadRes, dealRes, taskRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone')
          .eq('organization_id', organizationId)
          .ilike('name', term)
          .limit(5),

        supabase
          .from('leads')
          .select('id, name, phone')
          .eq('organization_id', organizationId)
          .ilike('name', term)
          .limit(5),

        supabase
          .from('deals')
          .select('id, title, value')
          .eq('organization_id', organizationId)
          .ilike('title', term)
          .limit(5),

        supabase
          .from('tasks')
          .select('id, title')
          .eq('organization_id', organizationId)
          .ilike('title', term)
          .limit(5),
      ])

      const firstError =
        custRes.error ||
        leadRes.error ||
        dealRes.error ||
        taskRes.error

      if (firstError) {
        throw firstError
      }

      const customerResults: Result[] = (custRes.data ?? []).map(
        (customer: any) => ({
          id: customer.id,
          label: customer.name || 'عميل بدون اسم',
          sub: customer.phone ?? '',
          href: `#/crm/customer/${customer.id}`,
          type: 'عميل',
        })
      )

      const leadResults: Result[] = (leadRes.data ?? []).map(
        (lead: any) => ({
          id: lead.id,
          label: lead.name || 'عميل محتمل بدون اسم',
          sub: lead.phone ?? '',
          href: '#/crm',
          type: 'عميل محتمل',
        })
      )

      const dealResults: Result[] = (dealRes.data ?? []).map(
        (deal: any) => ({
          id: deal.id,
          label: deal.title || 'صفقة بدون عنوان',
          sub: `${deal.value ?? 0} ج.م`,
          href: `#/pipeline/deal/${deal.id}`,
          type: 'صفقة',
        })
      )

      const taskResults: Result[] = (taskRes.data ?? []).map(
        (task: any) => ({
          id: task.id,
          label: task.title || 'مهمة بدون عنوان',
          sub: '',
          href: '#/tasks',
          type: 'مهمة',
        })
      )

      setResults([
        ...customerResults,
        ...leadResults,
        ...dealResults,
        ...taskResults,
      ])
    } catch (err) {
      console.error('Search error:', err)
      setResults([])
      setError('تعذر تنفيذ البحث حاليًا. حاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setQ('')
    setResults([])
    setError('')
  }

  const hasQuery = q.trim().length >= 2

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-950">
          البحث
        </h1>
        <p className="text-sm text-ink-900/55 mt-1">
          ابحث بسرعة داخل العملاء والصفقات والمهام.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3 bg-sand-50 border border-sand-200 rounded-2xl px-4 py-3.5 focus-within:border-ink-900/30 focus-within:ring-2 focus-within:ring-ink-900/5 transition-all">
          <IconSearch className="w-5 h-5 text-ink-900/40 shrink-0" />

          <input
            value={q}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="ابحث في العملاء، الصفقات، المهام..."
            className="bg-transparent outline-none text-sm sm:text-base w-full text-ink-950 placeholder:text-ink-900/35"
            autoFocus
            aria-label="البحث"
          />

          {q && (
            <Button
              type="button"
              variant="secondary"
              onClick={clearSearch}
              className="shrink-0 px-3 py-2 text-xs"
            >
              مسح
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 text-xs text-ink-900/45">
          <span>
            اكتب حرفين على الأقل لبدء البحث
          </span>

          {hasQuery && !loading && !error && (
            <span>
              {results.length} نتيجة
            </span>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-5 border-red-200 bg-red-50/60" role="alert">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-red-900">
                حدث خطأ أثناء البحث
              </div>
              <p className="text-sm text-red-800/70 mt-1">
                {error}
              </p>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => runSearch(q)}
              className="shrink-0"
            >
              إعادة المحاولة
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <Card
              key={item}
              className="p-4 sm:p-5 animate-pulse"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-sand-200 rounded-lg w-2/3" />
                  <div className="h-3 bg-sand-100 rounded-lg w-1/3" />
                </div>

                <div className="h-7 w-20 bg-sand-200 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && !hasQuery && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center">
            <IconSearch className="w-6 h-6 text-ink-900/45" />
          </div>

          <h2 className="text-lg font-bold text-ink-950 mt-5">
            ابدأ البحث
          </h2>

          <p className="text-sm text-ink-900/50 mt-2 max-w-md mx-auto leading-6">
            استخدم مربع البحث للوصول بسرعة إلى العملاء والصفقات والمهام داخل شركتك.
          </p>
        </Card>
      )}

      {!loading && !error && hasQuery && results.length === 0 && (
        <Card className="p-8 sm:p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center">
            <IconSearch className="w-6 h-6 text-ink-900/40" />
          </div>

          <h2 className="text-lg font-bold text-ink-950 mt-5">
            لا توجد نتائج
          </h2>

          <p className="text-sm text-ink-900/50 mt-2">
            جرّب البحث بكلمة مختلفة أو تأكد من كتابة الاسم بشكل صحيح.
          </p>
        </Card>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-ink-950">
              نتائج البحث
            </h2>

            <span className="text-xs text-ink-900/45">
              {results.length} نتيجة
            </span>
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <a
                key={`${result.type}-${result.id}`}
                href={result.href}
                className="block group"
              >
                <Card className="p-4 sm:p-5 transition-all duration-200 hover:border-ink-900/25 hover:shadow-md group-focus-within:ring-2 group-focus-within:ring-ink-900/10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-base text-ink-950 truncate">
                        {result.label}
                      </div>

                      {result.sub && (
                        <div className="text-xs sm:text-sm text-ink-900/45 mt-1 truncate">
                          {result.sub}
                        </div>
                      )}
                    </div>

                    <Badge>
                      {result.type}
                    </Badge>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
