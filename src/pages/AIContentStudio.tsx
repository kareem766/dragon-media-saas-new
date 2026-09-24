import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useIsPlatformAdmin } from '../lib/useIsPlatformAdmin'
import { usePermissions } from '../lib/usePermissions'

type Post = {
  id:string; prompt:string; content_type:string; tone:string; image_style:string
  hook:string; content:string; cta:string; image_url:string|null; status:string
  target_platforms:string[]; scheduled_at:string|null; created_at:string; updated_at:string
  metadata?: { image_generation_failed?: boolean; image_generation_error?: string|null; image_generation_provider?: string }
}

const types = [
  ['custom','مخصص'],['promotion','عرض / ترويج'],['educational','تعليمي'],
  ['awareness','توعوي'],['branding','هوية وبراند'],['product','منتج'],['service','خدمة']
]
const tones = [['professional','احترافي'],['friendly','ودود'],['bold','جريء'],['luxury','فاخر'],['simple','بسيط']]
const imageStyles = [['modern','Modern'],['minimal','Minimal'],['luxury','Luxury'],['bold','Bold'],['professional','Professional']]

async function api(path:string, session:any, init?:RequestInit) {
  const response = await fetch(path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...(init?.headers||{})}})
  const data = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(data?.error || 'حدث خطأ أثناء تنفيذ الطلب.')
  return data
}

export default function AIContentStudio() {
  const { session } = useAuth()
  const { isAdmin } = useIsPlatformAdmin()
  const { can } = usePermissions()
  const canView = isAdmin || can('ai_content','view')
  const canEdit = isAdmin || can('ai_content','edit')
  const canDelete = isAdmin || can('ai_content','delete')
  const [posts,setPosts] = useState<Post[]>([])
  const [prompt,setPrompt] = useState('')
  const [contentType,setContentType] = useState('custom')
  const [tone,setTone] = useState('professional')
  const [imageStyle,setImageStyle] = useState('modern')
  const [active,setActive] = useState<Post|null>(null)
  const [loading,setLoading] = useState(true)
  const [generating,setGenerating] = useState(false)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [platforms,setPlatforms] = useState<string[]>(['facebook'])
  const [publishing,setPublishing] = useState(false)
  const [regeneratingImage,setRegeneratingImage] = useState(false)
  const [canGenerateImages,setCanGenerateImages] = useState(false)
  const [publishSuccess,setPublishSuccess] = useState(false)

  const load = async () => {
    if (!session) return
    setLoading(true); setError('')
    try {
      const data=await api('/api/admin/ai-content',session)
      setPosts(data.posts||[])
      setActive((data.posts||[])[0]||null)
      setCanGenerateImages(Boolean(data.canGenerateImages))
    } catch(e){setError(e instanceof Error?e.message:'تعذر تحميل المحتوى.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[session?.access_token])

  const generate = async () => {
    if (!session || !canEdit || prompt.trim().length<5) return
    setGenerating(true); setError('')
    try {
      const data=await api('/api/admin/ai-content',session,{method:'POST',body:JSON.stringify({action:'generate',prompt,contentType,tone,imageStyle})})
      setPosts((prev)=>[data.post,...prev.filter((p:Post)=>p.id!==data.post.id)])
      setActive(data.post); setPrompt('')
      if (data.imageError) setError(data.imageError)
    } catch(e){setError(e instanceof Error?e.message:'تعذر إنشاء البوست.')}
    finally{setGenerating(false)}
  }

  const update = async (patch:Partial<Post>) => {
    if (!session || !active || !canEdit) return
    setSaving(true); setError('')
    try {
      const data=await api('/api/admin/ai-content',session,{method:'PATCH',body:JSON.stringify({id:active.id,...patch})})
      setActive(data.post); setPosts((prev)=>prev.map((p)=>p.id===data.post.id?data.post:p))
    } catch(e){setError(e instanceof Error?e.message:'تعذر حفظ التعديل.')}
    finally{setSaving(false)}
  }

  const regenerateImage = async () => {
    if (!session || !active || !canEdit) return
    setRegeneratingImage(true); setError('')
    try {
      const data=await api('/api/admin/ai-content',session,{method:'POST',body:JSON.stringify({action:'regenerate_image',id:active.id})})
      setActive(data.post); setPosts((prev)=>prev.map((p)=>p.id===data.post.id?data.post:p))
    } catch(e){setError(e instanceof Error?e.message:'تعذر إعادة إنشاء الصورة.')}
    finally{setRegeneratingImage(false)}
  }

  const publish = async () => {
    if (!session || !active || !platforms.length) return
    setPublishing(true); setError('')
    try {
      const data=await api('/api/admin/ai-content-publish',session,{method:'POST',body:JSON.stringify({id:active.id,platforms})})
      setActive(data.post); setPosts((prev)=>prev.map((p)=>p.id===data.post.id?data.post:p))
      const failed=Object.values(data.results||{}).filter((x:any)=>x?.status==='failed') as any[]
      if (failed.length) setError('تم تنفيذ النشر للمنصات المتاحة، وبعض المنصات لم تنجح. راجع حالة كل منصة.')
      else {
        setPublishSuccess(true)
        window.setTimeout(()=>setPublishSuccess(false),4500)
      }
    } catch(e){setError(e instanceof Error?e.message:'تعذر نشر البوست.')}
    finally{setPublishing(false)}
  }

  const deletePost = async () => {
    if (!session || !active || !canEdit) return
    if (!window.confirm('حذف مسودة البوست؟')) return
    setSaving(true)
    try {
      await api('/api/admin/ai-content',session,{method:'DELETE',body:JSON.stringify({id:active.id})})
      const next=posts.filter((p)=>p.id!==active.id); setPosts(next); setActive(next[0]||null)
    } catch(e){setError(e instanceof Error?e.message:'تعذر حذف البوست.')}
    finally{setSaving(false)}
  }

  const caption = useMemo(()=>active?[active.hook,active.content,active.cta].filter(Boolean).join('\n\n'):'',[active])

  if (!canView) return <div dir="rtl" className="p-4 sm:p-6"><div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">ليس لديك صلاحية الوصول إلى استوديو المحتوى.</div></div>

  return (
    <main dir="rtl" className="mx-auto w-full max-w-7xl px-2 pb-6 pt-2 sm:px-5 sm:pb-12 sm:pt-5">
      <div className="space-y-3 sm:space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-sm sm:rounded-[28px]">
          <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="relative p-3 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-gold-50 px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-gold-700">✦ AI CONTENT STUDIO</span>
                  <span className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[10px] font-bold text-ink-900/45">Gemini • كتابة المحتوى</span>
                </div>
                <h1 className="mt-2 text-xl font-extrabold tracking-tight text-ink-950 sm:mt-3 sm:text-3xl">استوديو المحتوى بالـAI</h1>
                <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-ink-900/50 sm:mt-2 sm:text-sm sm:leading-6">حوّل فكرة بسيطة إلى بوست احترافي جاهز للمراجعة والنشر، بصياغة تناسب نشاط شركتك.</p>
              </div>
              <div className="hidden shrink-0 rounded-2xl border border-sand-100 bg-sand-50 px-3 py-2 text-center sm:block"><div className="text-[10px] font-bold text-ink-900/40">المرحلة الحالية</div><div className="mt-1 text-xs font-extrabold text-ink-950">كتابة + مراجعة</div></div>
            </div>
            <div className="mt-3 hidden grid-cols-3 gap-2 sm:grid">
              {['اكتب الفكرة','راجع المحتوى','انشر'].map((item,i)=><div key={item} className="rounded-2xl border border-sand-100 bg-sand-50/60 px-2 py-3 text-center"><span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-gold-700 shadow-sm">{i+1}</span><span className="mt-2 block text-[10px] font-bold text-ink-900/55 sm:text-xs">{item}</span></div>)}
            </div>
          </div>
        </section>

        {publishSuccess && <div role="status" aria-live="polite" className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white shadow-sm">✓</div><div><div className="text-sm font-extrabold text-emerald-800 sm:text-base">مبروك، تم النشر بنجاح 🎉</div><p className="mt-0.5 text-[11px] leading-5 text-emerald-700/80 sm:text-xs">تم نشر البوست على المنصة التي اخترتها بنجاح.</p></div></div></div>}
        {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-6 text-red-700 sm:text-sm"><span className="mt-0.5 shrink-0">!</span><span>{error}</span></div>}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px] sm:gap-4">
          <section className="rounded-2xl border border-ink-900/10 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-extrabold text-ink-950 sm:text-xl">أنشئ بوست جديد</h2><p className="mt-1 text-xs leading-5 text-ink-900/45">اكتب الفكرة بطريقتك، وخلّي Gemini يتولى الصياغة.</p></div>
              <span className="shrink-0 rounded-xl bg-sand-50 px-2.5 py-2 text-[10px] font-extrabold text-ink-900/50">GEMINI</span>
            </div>

            <div className="relative mt-3 sm:mt-4">
              <textarea aria-label="فكرة البوست" value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={generating||!canEdit} rows={4} maxLength={1200} placeholder="مثال: عايز بوست عن أهمية إدارة الحملات الإعلانية للشركات الصغيرة مع دعوة للتواصل معنا..." className="w-full resize-none rounded-[22px] border border-sand-200 bg-sand-50/40 px-4 py-4 text-sm leading-7 text-ink-950 outline-none transition placeholder:text-ink-900/30 focus:border-ink-800 focus:bg-white focus:ring-4 focus:ring-ink-900/5 disabled:opacity-60 sm:min-h-[150px]" />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-bold text-ink-900/35">{prompt.length}/1200</div>
            </div>

            <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
              <Select label="نوع المحتوى" value={contentType} setValue={setContentType} options={types}/>
              <Select label="نبرة المحتوى" value={tone} setValue={setTone} options={tones}/>
              <Select label="ستايل الـCreative" value={imageStyle} setValue={setImageStyle} options={imageStyles}/>
            </div>

            {!canGenerateImages && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold-100 bg-gold-50/60 px-4 py-3"><span className="mt-0.5">✦</span><div><div className="text-xs font-extrabold text-gold-800">سوف تتوفر خدمة توليد الصور قريبًا على منصة دراجون ميديا</div><p className="mt-1 text-[11px] leading-5 text-gold-800/70">الكتابة بالـAI تعمل بشكل طبيعي. سنعيد تفعيل الـCreative عند توفر حصة توليد الصور.</p></div></div>}

            <button type="button" onClick={()=>void generate()} disabled={generating||!canEdit||prompt.trim().length<5} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-ink-800 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">
              <span>{generating?'جاري إنشاء المحتوى…':'إنشاء البوست بالـAI'}</span><span aria-hidden="true">{generating?'…':'✦'}</span>
            </button>
          </section>

          <section className="rounded-2xl border border-ink-900/10 bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold text-ink-950 sm:text-xl">المحتوى السابق</h2><p className="mt-1 text-xs text-ink-900/40">آخر البوستات التي أنشأتها</p></div><span className="rounded-xl bg-sand-50 px-3 py-2 text-[10px] font-extrabold text-ink-900/40">{posts.length} بوست</span></div>
            {loading ? <div className="py-12 text-center text-xs text-ink-900/40">جاري تحميل المحتوى…</div> : posts.length===0 ? <div className="my-4 rounded-2xl border border-dashed border-sand-200 bg-sand-50/40 px-5 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">✦</div><div className="mt-3 text-sm font-extrabold text-ink-950">لا يوجد محتوى بعد</div><p className="mt-1 text-xs leading-5 text-ink-900/40">ابدأ بفكرة بسيطة، وسنجهز لك أول بوست.</p></div> : <div className="mt-3 max-h-[320px] sm:mt-4 sm:max-h-[430px] space-y-2 overflow-y-auto overscroll-contain pr-0.5">{posts.map(p=><button key={p.id} type="button" onClick={()=>setActive(p)} className={`w-full rounded-2xl border p-3 text-right transition active:scale-[.99] ${active?.id===p.id?'border-gold-300 bg-gold-50/70 shadow-sm':'border-sand-200 bg-white hover:bg-sand-50'}`}><div className="flex items-start gap-3">{p.image_url?<img src={p.image_url} className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14" alt="" />:<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-xs text-ink-900/25 sm:h-14 sm:w-14">AI</div>}<div className="min-w-0 flex-1"><div className="truncate text-xs font-extrabold text-ink-950 sm:text-sm">{p.hook||'بوست بدون Hook'}</div><div className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink-900/45 sm:text-xs">{p.content}</div></div></div></button>)}</div>}
          </section>
        </div>

        {active && <section className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-sm sm:rounded-[28px]">
          <div className="border-b border-sand-100 px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="text-[10px] font-extrabold text-gold-700">معاينة وتحرير</div><h2 className="mt-1 text-lg font-extrabold text-ink-950 sm:text-xl">البوست جاهز للمراجعة</h2></div>
              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"><button onClick={()=>void update({status:'draft'})} disabled={saving} className="min-h-10 rounded-xl border border-sand-200 px-3 text-[11px] font-bold text-ink-900 disabled:opacity-50">حفظ</button><button onClick={()=>void deletePost()} disabled={saving||!canDelete} className="min-h-10 rounded-xl border border-red-100 px-3 text-[11px] font-bold text-red-600 disabled:opacity-50">حذف</button><button onClick={()=>void publish()} disabled={publishing||saving||!canEdit||!platforms.length||(!active.image_url&&canGenerateImages)} className="min-h-10 rounded-xl bg-ink-950 px-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{publishing?'جاري…':'نشر الآن'}</button></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="order-2 space-y-3 p-3 sm:space-y-4 sm:p-6 lg:order-1">
              <Editable label="Hook" value={active.hook} disabled={!canEdit} onChange={v=>setActive({...active,hook:v})} onBlur={()=>void update({hook:active.hook})}/>
              <Editable label="المحتوى" value={active.content} rows={7} disabled={!canEdit} onChange={v=>setActive({...active,content:v})} onBlur={()=>void update({content:active.content})}/>
              <Editable label="الدعوة للإجراء CTA" value={active.cta} disabled={!canEdit} onChange={v=>setActive({...active,cta:v})} onBlur={()=>void update({cta:active.cta})}/>
              <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4"><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-extrabold text-ink-900/45">معاينة النص</div><span className="text-[10px] font-bold text-ink-900/30">جاهز للمراجعة</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-950">{caption}</p></div>
            </div>

            <div className="order-1 border-b border-sand-100 bg-sand-50/40 p-3 sm:p-6 lg:order-2 lg:border-b-0 lg:border-r">
              {active.image_url ? <img src={active.image_url} alt="Creative البوست" className="aspect-[4/3] w-full rounded-2xl sm:aspect-square sm:rounded-[24px] object-cover shadow-sm" /> : <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[24px] border border-dashed border-gold-200 bg-white px-6 text-center"><div><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-50 text-xl">✦</div><div className="mt-4 text-sm font-extrabold text-ink-950">النص جاهز — الـCreative غير متاح حاليًا</div><p className="mt-2 text-xs leading-6 text-ink-900/45">{canGenerateImages ? 'يمكنك محاولة إنشاء الصورة مرة أخرى.' : 'توليد الصور متوقف مؤقتًا، لكن يمكنك مراجعة النص ونشره.'}</p></div></div>}

              <div className="mt-3 rounded-2xl border border-sand-200 bg-white p-3 sm:mt-4 sm:p-4">
                <div className="flex items-center justify-between gap-2"><div className="text-xs font-extrabold text-ink-900/55">منصات النشر</div><span className="text-[10px] font-bold text-ink-900/30">اختر منصة أو أكثر</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><PlatformButton label="Facebook" selected={platforms.includes('facebook')} onClick={()=>setPlatforms((p)=>p.includes('facebook')?p.filter(x=>x!=='facebook'):[...p,'facebook'])}/><PlatformButton label="Instagram" selected={platforms.includes('instagram')} onClick={()=>setPlatforms((p)=>p.includes('instagram')?p.filter(x=>x!=='instagram'):[...p,'instagram'])}/></div>
                {canGenerateImages && <button type="button" onClick={()=>void regenerateImage()} disabled={regeneratingImage||publishing} className="mt-3 min-h-11 w-full rounded-xl border border-sand-200 px-3 py-3 text-xs font-bold text-ink-900 transition hover:bg-sand-50 disabled:opacity-50">{regeneratingImage?'جاري إنشاء Creative جديد…':'إعادة إنشاء الصورة'}</button>}
                <p className="mt-3 text-[10px] leading-5 text-ink-900/35">النشر يتم من الخادم مباشرة، ولا يتم إرسال Access Tokens إلى المتصفح.</p>
              </div>
            </div>
          </div>
        </section>}
      </div>
    </main>
  )
}

function PlatformButton({label,selected,onClick}:{label:string;selected:boolean;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className={`min-h-11 rounded-xl border px-3 py-3 text-xs font-bold transition active:scale-[.98] ${selected?'border-gold-300 bg-gold-50 text-gold-800':'border-sand-200 bg-white text-ink-900/50 hover:bg-sand-50'}`}>{selected?'✓ ':''}{label}</button>
}

function Select({label,value,setValue,options}:{label:string;value:string;setValue:(v:string)=>void;options:string[][]}) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-ink-900/60">{label}</span><select value={value} onChange={e=>setValue(e.target.value)} className="min-h-11 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm font-semibold text-ink-950 outline-none focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
}

function Editable({label,value,onChange,onBlur,rows=4,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;onBlur:()=>void;rows?:number;disabled?:boolean}) {
  return <label className="block"><span className="mb-2 block text-xs font-extrabold text-ink-900/60">{label}</span><textarea value={value} rows={rows} disabled={disabled} onChange={e=>onChange(e.target.value)} onBlur={onBlur} className="min-h-11 w-full resize-none rounded-xl sm:rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sm leading-7 text-ink-950 outline-none focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5"/></label>
}
