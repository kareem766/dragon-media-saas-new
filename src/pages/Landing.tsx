import React from 'react'
import { Link } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'

const features = [
  ['إدارة العملاء CRM','نظّم العملاء والفرص والصفقات في مكان واحد مع متابعة واضحة لكل مرحلة.','CRM'],
  ['المبيعات والصفقات','تابع مراحل البيع والمهام والمتابعات من أول فرصة حتى إتمام الصفقة.','SALE'],
  ['استوديو المحتوى بالـAI','حوّل فكرتك إلى بوست احترافي بالـAI، اختَر نوع المحتوى والنبرة والستايل، راجع النص ثم انشره.','AI'],
  ['النشر على السوشيال','جهّز المحتوى للنشر واختر Facebook أو Instagram من نفس التجربة.','SOC'],
  ['Ryan AI','مساعد ذكي يفهم سياق المحادثات ويساعد في التعامل مع العملاء وجمع بياناتهم.','RYAN'],
  ['صندوق محادثات موحّد','اجمع محادثات قنوات التواصل في تجربة منظمة مع رؤية أوضح لكل عميل.','INBOX'],
  ['التسويق والحملات','أنشئ حملاتك وتابع نشاطك التسويقي من مساحة واحدة.','MKT'],
  ['التقارير والرؤية','حوّل نشاطك وبياناتك إلى مؤشرات تساعدك على متابعة الأداء واتخاذ القرار.','DATA']
]

export default function Landing() {
  const { branding, logoUrl } = useBranding()
  const name = branding?.platform_name || 'Dragon Media'

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_28%,#ffffff_52%,#fff9ed_76%,#f7fbff_100%)] text-ink-950">
      <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/85 shadow-[0_8px_28px_rgba(15,47,107,0.05)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          <Link to="/home" className="flex items-center gap-3 shrink-0">
            <img src={logoUrl} alt={name} className="h-10 w-auto rounded-full object-contain" />
            <span className="font-black text-lg hidden sm:block">{name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-50">تسجيل الدخول</Link>
            <Link to="/login?mode=signup" className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-blue-800">ابدأ الآن</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="dm-landing-hero relative overflow-hidden bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.10),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.09),transparent_24%),radial-gradient(circle_at_70%_85%,rgba(245,158,11,0.09),transparent_25%)] py-20 lg:py-28">
          <div className="absolute inset-0 pointer-events-none"><div className="absolute -top-32 -inset-inline-end-20 w-96 h-96 rounded-full bg-blue-200/30 blur-3xl"/><div className="absolute bottom-0 inset-inline-start-0 w-80 h-80 rounded-full bg-amber-100/35 blur-3xl"/></div>
          <div className="relative max-w-7xl mx-auto px-5 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-xs font-bold text-blue-800"><span className="w-2 h-2 rounded-full bg-cyan-400"/> منصة واحدة لإدارة رحلة العميل</div>
            <h1 className="mt-7 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">إدارة العملاء والمبيعات<br/><span className="text-blue-700">والتسويق من مكان واحد</span></h1>
            <p className="max-w-2xl mx-auto mt-6 text-lg leading-8 text-ink-900/60">إدارة العملاء والمبيعات والتسويق وخدمة العملاء من مكان واحد.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8"><Link to="/login?mode=signup" className="rounded-xl bg-blue-700 px-7 py-3.5 text-white font-black shadow-xl hover:bg-blue-800">ابدأ تجربة المنصة</Link><button type="button" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border border-blue-100 bg-white px-7 py-3.5 text-blue-800 font-bold">استكشف المميزات</button></div>
            <div className="dm-gold-line mx-auto mt-10"/>
          </div>
        </section>

        <section id="features" className="relative overflow-hidden border-y border-blue-100/70 bg-white/55 py-20 backdrop-blur-[2px] lg:py-28">
          <div className="absolute -top-32 inset-inline-end-0 h-80 w-80 rounded-full bg-blue-100/40 blur-3xl" aria-hidden="true"/>
          <div className="absolute bottom-0 inset-inline-start-0 h-72 w-72 rounded-full bg-amber-100/30 blur-3xl" aria-hidden="true"/>
          <div className="relative mx-auto max-w-7xl px-5">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-extrabold text-blue-800">✦ أدوات متكاملة لنمو نشاطك</span>
              <h2 className="mt-5 text-3xl font-black leading-tight lg:text-5xl">كل ما تحتاجه لإدارة العميل<br/><span className="text-blue-700">من أول تواصل إلى البيع والنمو</span></h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-ink-900/55 lg:text-lg">Dragon Media تجمع التشغيل، المبيعات، التسويق والذكاء الاصطناعي في تجربة واحدة بسيطة واحترافية.</p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(([title,description,code], index) => (
                <article key={title} className={`group relative overflow-hidden rounded-[26px] border bg-white p-6 shadow-[0_14px_40px_rgba(15,47,107,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,47,107,0.11)] ${code==='AI'?'border-blue-200 bg-[linear-gradient(145deg,#ffffff_0%,#f3f8ff_100%)] lg:col-span-2':''}`}>
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-blue-700 via-cyan-400 to-amber-400 opacity-80"/>
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black shadow-sm ${code==='AI'?'bg-blue-700 text-white':'bg-blue-50 text-blue-700'}`}>{code}</div>
                    <span className="text-xs font-black text-ink-900/20">0{index+1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-black text-ink-950">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-ink-900/55">{description}</p>
                  {code==='AI' && <div className="mt-5 flex flex-wrap gap-2">
                    {['كتابة بالـAI','أنواع محتوى متعددة','نبرات مختلفة','مراجعة وتحرير','Facebook + Instagram'].map(x=><span key={x} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-bold text-blue-800 shadow-sm">{x}</span>)}
                  </div>}
                </article>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-[30px] border border-blue-100 bg-[#071f45] p-5 text-white shadow-2xl sm:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <span className="text-xs font-extrabold text-cyan-300">AI CONTENT STUDIO</span>
                  <h3 className="mt-2 text-2xl font-black lg:text-3xl">فكرة واحدة → محتوى جاهز للنشر</h3>
                  <p className="mt-3 text-sm leading-7 text-white/65">اكتب فكرتك، اختَر نوع المحتوى والنبرة والستايل، راجع النتيجة وعدّلها، ثم اختر المنصة التي تريد النشر عليها.</p>
                </div>
                <Link to="/ai-content" className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-[#071f45] transition hover:-translate-y-0.5">استكشف استوديو المحتوى <span className="mr-2">←</span></Link>
              </div>
            </div>
          </div>
        </section>
        <section id="ryan" className="relative py-20 lg:py-28 bg-[linear-gradient(120deg,rgba(247,250,255,0.88),rgba(239,247,255,0.72),rgba(255,251,240,0.78))] overflow-hidden"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center"><div><span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">الذكاء الاصطناعي داخل المنصة</span><h2 className="mt-5 text-3xl lg:text-4xl font-black">Ryan AI — موظفك الذكي لخدمة العملاء</h2><p className="text-ink-900/60 leading-8 mt-6">مساعد ذكي مصمم لفهم سياق المحادثة والتعامل مع العميل بصورة طبيعية.</p><div className="mt-7 space-y-3">{['يفهم سياق المحادثة','يساعد في جمع بيانات العميل ومتابعته','تجربة محادثة عربية طبيعية'].map(x=><div key={x} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white p-4"><span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center">✓</span><span className="text-sm font-semibold">{x}</span></div>)}</div></div><div className="relative rounded-3xl border border-blue-900/30 bg-[#071f45] p-5 shadow-2xl overflow-hidden"><div className="flex items-center gap-3 border-b border-white/10 pb-4"><div className="w-11 h-11 rounded-full bg-cyan-300 text-[#071f45] flex items-center justify-center font-black">R</div><div><div className="font-black text-white">Ryan AI</div><div className="text-xs text-cyan-200 mt-1">مساعد {name}</div></div></div><div className="space-y-4 py-6"><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/90">أهلاً بحضرتك، أنا ريان. أقدر أساعدك إزاي النهاردة؟</div><div className="max-w-[75%] mr-auto rounded-2xl rounded-tl-md bg-cyan-300 text-[#071f45] p-4 text-sm leading-7 font-semibold">محتاج أعرف خدماتكم وأسعارها.</div><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/90">أكيد، خليني أعرف احتياج حضرتك الأول وأرشح لك الأنسب.</div></div></div></div></section>

        <section id="how-it-works" className="relative py-20 lg:py-28 bg-[linear-gradient(120deg,rgba(255,252,245,0.92),rgba(248,251,255,0.88),rgba(255,247,235,0.82))] overflow-hidden"><div className="max-w-7xl mx-auto px-5"><span className="text-sm font-bold text-gold-600">طريقة العمل</span><h2 className="mt-3 text-3xl lg:text-4xl font-black">ابدأ ببساطة وتوسع مع نشاطك</h2><div className="grid md:grid-cols-3 gap-5 mt-10">{[['01','أنشئ مساحة عملك'],['02','نظّم عملاءك ومبيعاتك'],['03','طوّر التشغيل مع الأتمتة']].map(([n,t])=><div key={n} className="rounded-2xl bg-white border border-sand-200 p-6"><span className="text-sm font-black text-blue-700">{n}</span><h3 className="mt-4 font-black text-lg">{t}</h3></div>)}</div></div></section>
        <section className="py-20 bg-blue-700 text-white text-center"><h2 className="text-3xl lg:text-4xl font-black">جاهز تدير نشاطك باحترافية أكبر؟</h2><Link to="/login?mode=signup" className="inline-flex mt-8 rounded-xl bg-white px-7 py-3.5 text-blue-800 font-black">ابدأ الآن</Link></section>
      </main>
      <footer className="border-t border-blue-100/70 bg-white/70 py-8 backdrop-blur-md"><div className="max-w-7xl mx-auto px-5 flex justify-between text-sm text-ink-900/45"><span>© {new Date().getFullYear()} {name}</span><div className="flex gap-5"><Link to="/privacy">الخصوصية</Link><Link to="/terms">الشروط</Link></div></div></footer>
    </div>
  )
}
