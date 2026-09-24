import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { usePermissions } from '../lib/usePermissions'

type Post = {
  id:string; prompt:string; content_type:string; tone:string; image_style:string
  hook:string; content:string; cta:string; image_url:string|null; status:string
  target_platforms:string[]; scheduled_at:string|null; created_at:string; updated_at:string
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
  const { can } = usePermissions()
  const canEdit = can('ai_content','edit')
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

  const load = async () => {
    if (!session) return
    setLoading(true); setError('')
    try { const data=await api('/api/admin/ai-content',session); setPosts(data.posts||[]); setActive((data.posts||[])[0]||null) }
    catch(e){setError(e instanceof Error?e.message:'تعذر تحميل المحتوى.')}
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

  if (!can('ai_content','view')) return <div dir="rtl" className="p-6"><div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">ليس لديك صلاحية الوصول إلى استوديو المحتوى.</div></div>

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold-50 px-3 py-1.5 text-[10px] font-extrabold text-gold-700">✦ AI CONTENT STUDIO</div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-3xl">استوديو المحتوى بالذكاء الاصطناعي</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-900/50">اكتب فكرة البوست، وGemini يحولها إلى Hook ومحتوى وCTA وCreative بصري اعتمادًا على بيانات شركتك وخدماتك.</p>
        </div>
      </section>

      {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-extrabold text-ink-950">أنشئ بوست جديد</h2><p className="mt-1 text-xs text-ink-900/45">صف الفكرة كما تفكر فيها، بدون الحاجة لصياغة المحتوى بنفسك.</p></div>
            <span className="rounded-xl bg-sand-50 px-3 py-2 text-xs font-bold text-ink-900/50">Gemini</span>
          </div>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={generating||!canEdit} rows={6} placeholder="مثال: عايز بوست عن أهمية إدارة الحملات الإعلانية للشركات الصغيرة مع دعوة للتواصل معنا..." className="mt-5 w-full resize-none rounded-2xl border border-sand-200 bg-sand-50/40 px-4 py-4 text-sm leading-7 text-ink-950 outline-none transition focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5 disabled:opacity-60" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Select label="نوع المحتوى" value={contentType} setValue={setContentType} options={types}/>
            <Select label="النبرة" value={tone} setValue={setTone} options={tones}/>
            <Select label="ستايل الصورة" value={imageStyle} setValue={setImageStyle} options={imageStyles}/>
          </div>
          <button type="button" onClick={()=>void generate()} disabled={generating||!canEdit||prompt.trim().length<5} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50">
            {generating ? 'جاري إنشاء المحتوى والصورة…' : 'إنشاء البوست بالـAI'}
          </button>
        </section>

        <section className="rounded-3xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-ink-950">المحتوى السابق</h2><span className="text-xs font-bold text-ink-900/40">{posts.length} بوست</span></div>
          {loading ? <div className="py-10 text-center text-sm text-ink-900/40">جاري التحميل…</div> :
            posts.length===0 ? <div className="py-10 text-center text-sm leading-6 text-ink-900/40">لم تنشئ أي محتوى بعد.<br/>ابدأ من النموذج بجانبك.</div> :
            <div className="mt-4 max-h-[520px] space-y-2 overflow-auto">{posts.map(p=><button key={p.id} type="button" onClick={()=>setActive(p)} className={`w-full rounded-2xl border p-3 text-right transition ${active?.id===p.id?'border-gold-300 bg-gold-50/60':'border-sand-200 bg-white hover:bg-sand-50'}`}><div className="flex items-start gap-3">{p.image_url?<img src={p.image_url} className="h-14 w-14 shrink-0 rounded-xl object-cover" alt="" />:<div className="h-14 w-14 shrink-0 rounded-xl bg-sand-100"/>}<div className="min-w-0"><div className="truncate text-sm font-extrabold text-ink-950">{p.hook||'بوست بدون Hook'}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-ink-900/45">{p.content}</div></div></div></button>)}</div>}
        </section>
      </div>

      {active && <section className="overflow-hidden rounded-3xl border border-ink-900/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-100 px-5 py-4 sm:px-6">
          <div><div className="text-xs font-bold text-gold-700">معاينة وتحرير</div><h2 className="mt-1 text-lg font-extrabold text-ink-950">البوست جاهز للمراجعة</h2></div>
          <div className="flex flex-wrap gap-2"><button onClick={()=>void update({status:'draft'})} disabled={saving} className="rounded-xl border border-sand-200 px-4 py-2 text-xs font-bold text-ink-900">حفظ كمسودة</button><button onClick={()=>void deletePost()} disabled={saving} className="rounded-xl border border-red-100 px-4 py-2 text-xs font-bold text-red-600">حذف</button><button onClick={()=>void publish()} disabled={publishing||saving||!platforms.length||!active.image_url} className="rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{publishing?'جاري النشر…':'نشر الآن'}</button></div>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_460px]">
          <div className="order-2 space-y-4 p-5 lg:order-1 sm:p-6">
            <Editable label="Hook" value={active.hook} onChange={v=>setActive({...active,hook:v})} onBlur={()=>void update({hook:active.hook})}/>
            <Editable label="Content" value={active.content} rows={10} onChange={v=>setActive({...active,content:v})} onBlur={()=>void update({content:active.content})}/>
            <Editable label="CTA" value={active.cta} onChange={v=>setActive({...active,cta:v})} onBlur={()=>void update({cta:active.cta})}/>
            <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4"><div className="text-xs font-extrabold text-ink-900/50">Preview Caption</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-950">{caption}</p></div>
          </div>
          <div className="order-1 border-b border-sand-100 bg-sand-50/40 p-5 lg:order-2 lg:border-b-0 lg:border-r sm:p-6">
            {active.image_url ? <img src={active.image_url} alt="Creative البوست" className="aspect-square w-full rounded-3xl object-cover shadow-sm" /> : <div className="flex aspect-square w-full items-center justify-center rounded-3xl border border-dashed border-sand-300 bg-white text-center text-sm leading-6 text-ink-900/40">لم يتم إنشاء الصورة.<br/>يمكنك إعادة توليدها لاحقًا.</div>}
            <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4"><div className="text-xs font-extrabold text-ink-900/50">اختيار منصات النشر</div><div className="mt-3 grid grid-cols-2 gap-2"><PlatformButton label="Facebook" selected={platforms.includes('facebook')} onClick={()=>setPlatforms((p)=>p.includes('facebook')?p.filter(x=>x!=='facebook'):[...p,'facebook'])}/><PlatformButton label="Instagram" selected={platforms.includes('instagram')} onClick={()=>setPlatforms((p)=>p.includes('instagram')?p.filter(x=>x!=='instagram'):[...p,'instagram'])}/></div><button type="button" onClick={()=>void regenerateImage()} disabled={regeneratingImage||publishing} className="mt-3 w-full rounded-xl border border-sand-200 px-3 py-3 text-xs font-bold text-ink-900 disabled:opacity-50">{regeneratingImage?'جاري إنشاء Creative جديد…':'إعادة إنشاء الصورة'}</button><p className="mt-3 text-[11px] leading-5 text-ink-900/40">النشر يتم من الخادم مباشرة ولا يتم إرسال Access Tokens إلى المتصفح.</p></div>
          </div>
        </div>
      </section>}
    </div>
  )
}

function PlatformButton({label,selected,onClick}:{label:string;selected:boolean;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${selected?'border-gold-300 bg-gold-50 text-gold-800':'border-sand-200 bg-white text-ink-900/50 hover:bg-sand-50'}`}>{selected?'✓ ':''}{label}</button>
}

function Select({label,value,setValue,options}:{label:string;value:string;setValue:(v:string)=>void;options:string[][]}) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-ink-900/60">{label}</span><select value={value} onChange={e=>setValue(e.target.value)} className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-sm font-semibold text-ink-950 outline-none focus:border-ink-800">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
}
function Editable({label,value,onChange,onBlur,rows=4}:{label:string;value:string;onChange:(v:string)=>void;onBlur:()=>void;rows?:number}) {
  return <label className="block"><span className="mb-2 block text-xs font-extrabold text-ink-900/60">{label}</span><textarea value={value} rows={rows} onChange={e=>onChange(e.target.value)} onBlur={onBlur} className="w-full resize-none rounded-2xl border border-sand-200 bg-white px-4 py-3 text-sm leading-7 text-ink-950 outline-none focus:border-ink-800 focus:ring-4 focus:ring-ink-900/5"/></label>
}
