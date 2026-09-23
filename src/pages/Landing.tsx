import React from 'react'
import { Link } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'

const features = [
  ['إدارة العملاء CRM','نظّم العملاء والفرص والصفقات في مكان واحد.'],
  ['المبيعات والصفقات','تابع مراحل البيع والمهام والمتابعات بسهولة.'],
  ['التسويق والحملات','أنشئ حملاتك وتابع نتائجها من مساحة واحدة.'],
  ['صندوق محادثات موحّد','اجمع محادثات قنوات التواصل في تجربة منظمة.'],
  ['Ryan AI','مساعد ذكي لفهم المحادثات والتعامل مع العملاء بصورة طبيعية.'],
  ['تقارير ورؤية أوضح','حوّل بيانات نشاطك إلى مؤشرات تساعدك على اتخاذ القرار.']
]

export default function Landing() {
  const { branding, logoUrl } = useBranding()
  const name = branding?.platform_name || 'Dragon Media'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.05),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.05),transparent_28%)] bg-white text-ink-950">
      <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/85 shadow-[0_8px_28px_rgba(15,47,107,0.05)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          <Link to="/home" className="flex items-center gap-3 shrink-0">
            <img src={logoUrl} alt={name} className="h-10 w-auto object-contain" />
            <span className="font-black text-lg hidden sm:block">{name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-50">تسجيل الدخول</Link>
            <Link to="/login?mode=signup" className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-blue-800">ابدأ الآن</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="dm-landing-hero relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 pointer-events-none"><div className="absolute -top-32 -inset-inline-end-20 w-96 h-96 rounded-full bg-blue-200/30 blur-3xl"/><div className="absolute bottom-0 inset-inline-start-0 w-80 h-80 rounded-full bg-amber-100/35 blur-3xl"/></div>
          <div className="relative max-w-7xl mx-auto px-5 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-xs font-bold text-blue-800"><span className="w-2 h-2 rounded-full bg-cyan-400"/> منصة واحدة لإدارة رحلة العميل</div>
            <h1 className="mt-7 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">إدارة العملاء والمبيعات<br/><span className="text-blue-700">والتسويق من مكان واحد</span></h1>
            <p className="max-w-2xl mx-auto mt-6 text-lg leading-8 text-ink-900/60">إدارة العملاء والمبيعات والتسويق وخدمة العملاء من مكان واحد.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8"><Link to="/login?mode=signup" className="rounded-xl bg-blue-700 px-7 py-3.5 text-white font-black shadow-xl hover:bg-blue-800">ابدأ تجربة المنصة</Link><button type="button" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border border-blue-100 bg-white px-7 py-3.5 text-blue-800 font-bold">استكشف المميزات</button></div>
            <div className="dm-gold-line mx-auto mt-10"/>
          </div>
        </section>

        <section id="features" className="relative py-20 lg:py-28 bg-white border-y border-blue-100 overflow-hidden">
          <div className="absolute top-16 inset-inline-start-10 dm-gold-ornament" aria-hidden="true"/>
          <div className="max-w-7xl mx-auto px-5"><div className="max-w-2xl mb-12"><span className="text-sm font-bold text-gold-600">كل أدواتك في مكان واحد</span><h2 className="mt-3 text-3xl lg:text-4xl font-black">منصة مصممة لنمو نشاطك</h2><p className="mt-4 text-ink-900/55 leading-8">اجمع أهم عمليات العمل والعملاء والمبيعات في تجربة واحدة.</p></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{features.map(([title,description]) => <article key={title} className="relative rounded-2xl border border-blue-100/80 bg-white/90 p-6 shadow-[0_10px_30px_rgba(15,47,107,0.04)] backdrop-blur-sm hover:-translate-y-1 hover:shadow-xl transition-all"><div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-black">✦</div><div className="absolute top-5 inset-inline-end-5 h-px w-10 bg-amber-500/70"/><h3 className="font-black text-lg mt-6">{title}</h3><p className="mt-3 text-sm leading-7 text-ink-900/55">{description}</p></article>)}</div>
          </div>
        </section>

        <section id="ryan" className="relative py-20 lg:py-28 bg-[#f7faff] overflow-hidden"><div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center"><div><span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">الذكاء الاصطناعي داخل المنصة</span><h2 className="mt-5 text-3xl lg:text-4xl font-black">Ryan AI — موظفك الذكي لخدمة العملاء</h2><p className="text-ink-900/60 leading-8 mt-6">مساعد ذكي مصمم لفهم سياق المحادثة والتعامل مع العميل بصورة طبيعية.</p><div className="mt-7 space-y-3">{['يفهم سياق المحادثة','يساعد في جمع بيانات العميل ومتابعته','تجربة محادثة عربية طبيعية'].map(x=><div key={x} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white p-4"><span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center">✓</span><span className="text-sm font-semibold">{x}</span></div>)}</div></div><div className="relative rounded-3xl border border-blue-900/30 bg-[#071f45] p-5 shadow-2xl overflow-hidden"><div className="flex items-center gap-3 border-b border-white/10 pb-4"><div className="w-11 h-11 rounded-full bg-cyan-300 text-[#071f45] flex items-center justify-center font-black">R</div><div><div className="font-black text-white">Ryan AI</div><div className="text-xs text-cyan-200 mt-1">مساعد {name}</div></div></div><div className="space-y-4 py-6"><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/90">أهلاً بحضرتك، أنا ريان. أقدر أساعدك إزاي النهاردة؟</div><div className="max-w-[75%] mr-auto rounded-2xl rounded-tl-md bg-cyan-300 text-[#071f45] p-4 text-sm leading-7 font-semibold">محتاج أعرف خدماتكم وأسعارها.</div><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/90">أكيد، خليني أعرف احتياج حضرتك الأول وأرشح لك الأنسب.</div></div></div></div></section>

        <section id="how-it-works" className="relative py-20 lg:py-28 bg-sand-50 overflow-hidden"><div className="max-w-7xl mx-auto px-5"><span className="text-sm font-bold text-gold-600">طريقة العمل</span><h2 className="mt-3 text-3xl lg:text-4xl font-black">ابدأ ببساطة وتوسع مع نشاطك</h2><div className="grid md:grid-cols-3 gap-5 mt-10">{[['01','أنشئ مساحة عملك'],['02','نظّم عملاءك ومبيعاتك'],['03','طوّر التشغيل مع الأتمتة']].map(([n,t])=><div key={n} className="rounded-2xl bg-white border border-sand-200 p-6"><span className="text-sm font-black text-blue-700">{n}</span><h3 className="mt-4 font-black text-lg">{t}</h3></div>)}</div></div></section>
        <section className="py-20 bg-blue-700 text-white text-center"><h2 className="text-3xl lg:text-4xl font-black">جاهز تدير نشاطك باحترافية أكبر؟</h2><Link to="/login?mode=signup" className="inline-flex mt-8 rounded-xl bg-white px-7 py-3.5 text-blue-800 font-black">ابدأ الآن</Link></section>
      </main>
      <footer className="border-t border-blue-100 bg-white py-8"><div className="max-w-7xl mx-auto px-5 flex justify-between text-sm text-ink-900/45"><span>© {new Date().getFullYear()} {name}</span><div className="flex gap-5"><Link to="/privacy">الخصوصية</Link><Link to="/terms">الشروط</Link></div></div></footer>
    </div>
  )
}
