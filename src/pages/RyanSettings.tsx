import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganization } from '../lib/useOrganization'

const DEFAULT_PERSONA = 'مصري، طبيعي، ودود، احترافي، سريع الفهم، يركز على احتياج العميل والخطوة التالية المناسبة.'

const DEFAULT_SETTINGS = {
  use_knowledge_base: true,
  remember_customer: true,
  max_history_messages: 40,
  max_knowledge_items: 50,
  emoji_mode: 'light',
  custom_rules: '',
}

type Settings = typeof DEFAULT_SETTINGS

export default function RyanSettings() {
  const navigate = useNavigate()
  const { organizationId, loading: orgLoading } = useOrganization()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [active, setActive] = useState(true)
  const [name, setName] = useState('Ryan')
  const [language, setLanguage] = useState('ar-EG')
  const [persona, setPersona] = useState(DEFAULT_PERSONA)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!organizationId) return
      setLoading(true)
      setError('')
      const { data, error: loadError } = await supabase
        .from('ai_agents')
        .select('id, name, persona, language, active, settings')
        .eq('organization_id', organizationId)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (loadError) {
        setError(loadError.message)
      } else if (data) {
        setAgentId(data.id)
        setName(data.name || 'Ryan')
        setPersona(data.persona || DEFAULT_PERSONA)
        setLanguage(data.language || 'ar-EG')
        setActive(data.active !== false)
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) })
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [organizationId])

  async function save() {
    if (!organizationId) return
    setSaving(true)
    setSaved(false)
    setError('')
    const payload = {
      organization_id: organizationId,
      name: name.trim() || 'Ryan',
      persona: persona.trim() || DEFAULT_PERSONA,
      language: language.trim() || 'ar-EG',
      active,
      settings: {
        ...settings,
        max_history_messages: Math.min(80, Math.max(12, Number(settings.max_history_messages) || 40)),
        max_knowledge_items: Math.min(80, Math.max(5, Number(settings.max_knowledge_items) || 50)),
      },
    }
    const result = agentId
      ? await supabase.from('ai_agents').update(payload).eq('id', agentId).eq('organization_id', organizationId)
      : await supabase.from('ai_agents').insert(payload).select('id').single()
    if (result.error) setError(result.error.message)
    else {
      if (!agentId && result.data?.id) setAgentId(result.data.id)
      setSaved(true)
    }
    setSaving(false)
  }

  if (orgLoading || loading) {
    return <div dir="rtl" className="mx-auto max-w-5xl p-6"><div className="rounded-3xl border border-sand-200 bg-white p-8 text-sm text-ink-600">جاري تحميل إعدادات Ryan…</div></div>
  }

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700">RYAN AI</p>
          <h1 className="mt-1 text-2xl font-bold text-ink-950">إعدادات Ryan</h1>
          <p className="mt-2 text-sm text-ink-600">اضبط شخصية Ryan، طريقة استخدام قاعدة المعرفة، وحفظ ذاكرة العميل عبر المحادثات.</p>
        </div>
        <button onClick={() => navigate('/ryan')} className="rounded-xl border border-sand-300 px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-sand-50">العودة إلى Ryan</button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">تم حفظ إعدادات Ryan بنجاح.</div>}

      <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-ink-950">الشخصية وطريقة الرد</h2>
        <p className="mt-1 text-sm text-ink-500">هذه القواعد تضاف إلى شخصية Ryan الأساسية وتؤثر على ردوده في القنوات المتصلة.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-ink-800">اسم المساعد</span><input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-sand-300 px-4 py-3 outline-none focus:border-ink-500" /></label>
          <label className="block"><span className="text-sm font-semibold text-ink-800">اللغة</span><select value={language} onChange={e => setLanguage(e.target.value)} className="mt-2 w-full rounded-xl border border-sand-300 bg-white px-4 py-3"><option value="ar-EG">العربية المصرية</option><option value="ar">العربية</option></select></label>
        </div>
        <label className="mt-4 block"><span className="text-sm font-semibold text-ink-800">وصف الشخصية</span><textarea value={persona} onChange={e => setPersona(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-sand-300 px-4 py-3 outline-none focus:border-ink-500" /></label>
        <label className="mt-4 block"><span className="text-sm font-semibold text-ink-800">قواعد إضافية للشركة</span><textarea value={settings.custom_rules} onChange={e => setSettings(s => ({ ...s, custom_rules: e.target.value }))} rows={6} placeholder="مثال: لا نذكر سعرًا إلا إذا كان موجودًا في قاعدة المعرفة. لا نعد العميل بنتيجة مضمونة." className="mt-2 w-full rounded-xl border border-sand-300 px-4 py-3 outline-none focus:border-ink-500" /></label>
      </section>

      <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-ink-950">الذاكرة والمعرفة</h2>
        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-sand-200 p-4"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="mt-1 h-4 w-4" /><span><b className="block text-sm text-ink-900">Ryan مفعل</b><small className="text-ink-500">يسمح لـ Ryan بالعمل تلقائيًا على القنوات المؤهلة.</small></span></label>
          <label className="flex items-start gap-3 rounded-2xl border border-sand-200 p-4"><input type="checkbox" checked={settings.remember_customer} onChange={e => setSettings(s => ({ ...s, remember_customer: e.target.checked }))} className="mt-1 h-4 w-4" /><span><b className="block text-sm text-ink-900">حفظ ذاكرة العميل</b><small className="text-ink-500">يحفظ النشاط، الهدف، الخدمة، الميزانية، التفضيلات، المشاكل وملخص المحادثة بشكل دائم داخل ملف العميل.</small></span></label>
          <label className="flex items-start gap-3 rounded-2xl border border-sand-200 p-4"><input type="checkbox" checked={settings.use_knowledge_base} onChange={e => setSettings(s => ({ ...s, use_knowledge_base: e.target.checked }))} className="mt-1 h-4 w-4" /><span><b className="block text-sm text-ink-900">استخدام قاعدة المعرفة</b><small className="text-ink-500">يجعل معلومات الشركة والخدمات وقاعدة المعرفة مرجع Ryan قبل الإجابة.</small></span></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block"><span className="text-sm font-semibold text-ink-800">عدد رسائل السياق</span><input type="number" min={12} max={80} value={settings.max_history_messages} onChange={e => setSettings(s => ({ ...s, max_history_messages: Number(e.target.value) }))} className="mt-2 w-full rounded-xl border border-sand-300 px-4 py-3" /><small className="mt-1 block text-xs text-ink-500">من 12 إلى 80 رسالة حديثة، بالإضافة إلى الذاكرة الدائمة.</small></label>
            <label className="block"><span className="text-sm font-semibold text-ink-800">عدد عناصر المعرفة</span><input type="number" min={5} max={80} value={settings.max_knowledge_items} onChange={e => setSettings(s => ({ ...s, max_knowledge_items: Number(e.target.value) }))} className="mt-2 w-full rounded-xl border border-sand-300 px-4 py-3" /><small className="mt-1 block text-xs text-ink-500">من 5 إلى 80 عنصرًا من أحدث قاعدة المعرفة.</small></label>
          </div>
          <label className="block"><span className="text-sm font-semibold text-ink-800">الإيموجي</span><select value={settings.emoji_mode} onChange={e => setSettings(s => ({ ...s, emoji_mode: e.target.value }))} className="mt-2 w-full rounded-xl border border-sand-300 bg-white px-4 py-3"><option value="none">بدون إيموجي</option><option value="light">خفيف وطبيعي</option><option value="limited">محدود</option></select></label>
        </div>
      </section>

      <section className="rounded-3xl border border-sand-200 bg-sand-50 p-5 md:p-6">
        <h2 className="text-lg font-bold text-ink-950">كيف يعمل Ryan الآن؟</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-700">
          <li>• يقرأ معلومات الشركة الأساسية ونوع النشاط والخدمات والأسعار المسجلة في المنصة.</li>
          <li>• يستخدم قاعدة المعرفة كمرجع قبل الرد، ولا يخترع معلومات غير موجودة.</li>
          <li>• يحتفظ بذاكرة دائمة للعميل بدل الاعتماد على آخر عدة رسائل فقط.</li>
          <li>• يستخدم سياقًا موسعًا من المحادثة الحالية، مع الذاكرة الدائمة كطبقة مستقلة.</li>
          <li>• يحفظ المعلومات الجديدة المهمة تلقائيًا في ملف العميل.</li>
          <li>• لا يحفظ كلمات المرور أو رموز التحقق أو أسرار الدفع والدخول.</li>
        </ul>
      </section>

      <div className="flex justify-end"><button disabled={saving} onClick={() => void save()} className="rounded-xl bg-ink-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جاري الحفظ…' : 'حفظ إعدادات Ryan'}</button></div>
    </div>
  )
}
