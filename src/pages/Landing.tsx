import React from 'react'
import { Link } from 'react-router-dom'
import { useBranding } from '../hooks/useBranding'

function Icon({
  children,
  className = 'w-6 h-6',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const features = [
  {
    title: 'إدارة العملاء CRM',
    description:
      'نظّم العملاء والفرص والصفقات في مكان واحد، وتابع كل عميل من أول تواصل لحد إتمام البيع.',
    icon: (
      <Icon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    ),
  },
  {
    title: 'صندوق محادثات موحد',
    description:
      'تابع محادثات عملائك وتفاعلاتهم من مكان واحد بدل التنقل بين أكثر من منصة.',
    icon: (
      <Icon>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </Icon>
    ),
  },
  {
    title: 'الحملات التسويقية',
    description:
      'خطط لحملاتك، تابع العملاء المستهدفين، ونظّم عمليات المتابعة والتحويل.',
    icon: (
      <Icon>
        <path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-5h5l4 3V6l-4 3H7a4 4 0 0 0-4 2z" />
        <path d="M19 9v6" />
      </Icon>
    ),
  },
  {
    title: 'RYAN AI',
    description:
      'مساعد ذكي يساعدك في الرد على العملاء، جمع بيانات العملاء المحتملين، وتحويل المحادثات إلى فرص بيع.',
    icon: (
      <Icon>
        <path d="M12 3v3" />
        <path d="M18.36 5.64 16.24 7.76" />
        <path d="M21 12h-3" />
        <path d="m18.36 18.36-2.12-2.12" />
        <path d="M12 18v3" />
        <path d="m5.64 18.36 2.12-2.12" />
        <path d="M3 12h3" />
        <path d="m5.64 5.64 2.12 2.12" />
        <circle cx="12" cy="12" r="4" />
      </Icon>
    ),
  },
  {
    title: 'الأتمتة',
    description:
      'حوّل المهام المتكررة إلى عمليات تلقائية تساعد فريقك على توفير الوقت وتقليل الأخطاء.',
    icon: (
      <Icon>
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="m4.93 4.93 2.83 2.83" />
        <path d="m16.24 16.24 2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="m4.93 19.07 2.83-2.83" />
        <path d="m16.24 7.76 2.83-2.83" />
        <circle cx="12" cy="12" r="4" />
      </Icon>
    ),
  },
  {
    title: 'التقارير والتحليلات',
    description:
      'احصل على رؤية أوضح لأداء المبيعات والعملاء والحملات واتخذ قراراتك بناءً على البيانات.',
    icon: (
      <Icon>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="m7 15 3-4 3 2 5-7" />
      </Icon>
    ),
  },
]

const workflow = [
  {
    number: '01',
    title: 'اجمع بيانات عملائك',
    description:
      'اجمع العملاء المحتملين والعملاء الحاليين ونظّم بياناتهم في مساحة عمل واحدة.',
  },
  {
    number: '02',
    title: 'نظّم رحلة البيع',
    description:
      'تابع كل فرصة بيع من أول تواصل وحتى التعاقد من خلال Pipeline واضح.',
  },
  {
    number: '03',
    title: 'أتمت العمليات',
    description:
      'خلّي المهام المتكررة والمتابعات تعمل تلقائيًا بدل ما تضيع وقت فريقك.',
  },
  {
    number: '04',
    title: 'نمّي نشاطك',
    description:
      'استخدم التقارير والذكاء الاصطناعي لفهم الأداء وتحسين تجربة عملائك.',
  },
]

export default function Landing() {
  const { branding, logoUrl } = useBranding()

  const platformName =
    branding?.platform_name || 'Dragon Media'

  const description =
    branding?.description ||
    'منصة متكاملة لإدارة العملاء والمبيعات والتسويق وخدمة العملاء.'

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-sand-50 text-ink-950 overflow-x-hidden"
    >
      <header className="sticky top-0 z-50 border-b border-sand-200/80 bg-sand-50/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between gap-6">
            <Link
              to="/home"
              className="flex items-center gap-3 shrink-0"
            >
              <img
                src={logoUrl}
                alt={platformName}
                className="w-11 h-11 rounded-xl object-contain"
              />

              <div>
                <div className="font-black text-lg leading-none">
                  {platformName}
                </div>

                <div className="text-[11px] text-ink-900/45 mt-1">
                  إدارة أعمالك بذكاء
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7 text-sm text-ink-900/65">
              <a
                href="#features"
                className="hover:text-ink-950 transition-colors"
              >
                المميزات
              </a>

              <a
                href="#how-it-works"
                className="hover:text-ink-950 transition-colors"
              >
                كيف تعمل؟
              </a>

              <a
                href="#ryan"
                className="hover:text-ink-950 transition-colors"
              >
                RYAN AI
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-white transition-colors"
              >
                تسجيل الدخول
              </Link>

              <Link
                to="/login?mode=signup"
                className="inline-flex items-center justify-center rounded-xl bg-ink-950 text-white px-4 sm:px-5 py-2.5 text-sm font-bold shadow-lg shadow-ink-950/10 hover:bg-ink-800 transition-all"
              >
                إنشاء حساب
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gold-400/10 blur-3xl" />
            <div className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-20 lg:pb-28">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white/80 px-4 py-2 text-xs sm:text-sm text-ink-900/65 shadow-sm mb-7">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                منصة واحدة لإدارة دورة عملائك بالكامل
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.08]">
                حوّل إدارة عملائك
                <br />
                إلى{' '}
                <span className="text-gold-600">
                  نمو حقيقي
                </span>
              </h1>

              <p className="max-w-2xl mx-auto mt-7 text-base sm:text-lg lg:text-xl leading-8 text-ink-900/60">
                {description} اجمع عملائك، نظّم مبيعاتك،
                تابع حملاتك، وأتمت عملياتك من منصة واحدة
                مصممة لنمو نشاطك.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
                <Link
                  to="/login?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ink-950 text-white px-7 py-3.5 font-bold shadow-xl shadow-ink-950/15 hover:-translate-y-0.5 hover:bg-ink-800 transition-all"
                >
                  ابدأ الآن
                  <span aria-hidden="true">←</span>
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-sand-300 bg-white px-7 py-3.5 font-bold text-ink-950 hover:bg-sand-100 transition-colors"
                >
                  تسجيل الدخول
                </Link>
              </div>
            </div>

            <div className="mt-16 lg:mt-20 max-w-6xl mx-auto">
              <div className="relative rounded-3xl border border-sand-200 bg-white p-2 sm:p-3 shadow-2xl shadow-ink-950/10">
                <div className="rounded-2xl bg-ink-950 overflow-hidden">
                  <div className="h-10 border-b border-white/10 flex items-center gap-2 px-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  </div>

                  <div className="grid grid-cols-12 min-h-[300px] sm:min-h-[420px]">
                    <div className="hidden sm:block col-span-2 border-l border-white/10 p-4">
                      <div className="w-8 h-8 rounded-lg bg-gold-500/20 mb-7" />

                      <div className="space-y-4">
                        <div className="h-2.5 rounded bg-white/15" />
                        <div className="h-2.5 rounded bg-white/10" />
                        <div className="h-2.5 rounded bg-white/10" />
                        <div className="h-2.5 rounded bg-white/10" />
                        <div className="h-2.5 rounded bg-white/10" />
                      </div>
                    </div>

                    <div className="col-span-12 sm:col-span-10 p-5 sm:p-8">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="h-3 w-24 rounded bg-white/15" />
                          <div className="h-7 w-48 rounded bg-white/10 mt-3" />
                        </div>

                        <div className="w-10 h-10 rounded-full bg-white/10" />
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
                        {[
                          'العملاء',
                          'الفرص',
                          'المبيعات',
                          'المحادثات',
                        ].map((item, index) => (
                          <div
                            key={item}
                            className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                          >
                            <div className="text-xs text-white/45">
                              {item}
                            </div>

                            <div className="text-2xl font-bold text-white mt-3">
                              {['248', '76', '32', '419'][index]}
                            </div>

                            <div className="h-1.5 rounded-full bg-white/10 mt-4">
                              <div
                                className="h-full rounded-full bg-gold-500"
                                style={{
                                  width: `${[72, 54, 68, 82][index]}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
                        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.04] p-5">
                          <div className="text-xs text-white/45">
                            أداء المبيعات
                          </div>

                          <div className="flex items-end gap-2 h-40 mt-5">
                            {[35, 48, 42, 65, 58, 76, 68, 91, 82, 96].map(
                              (height, index) => (
                                <div
                                  key={index}
                                  className="flex-1 rounded-t-md bg-gold-500/70"
                                  style={{
                                    height: `${height}%`,
                                  }}
                                />
                              )
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                          <div className="text-xs text-white/45">
                            أحدث العملاء
                          </div>

                          <div className="space-y-4 mt-5">
                            {[
                              'محمد أحمد',
                              'شركة النور',
                              'أحمد محمود',
                              'عيادة الحياة',
                            ].map((name, index) => (
                              <div
                                key={name}
                                className="flex items-center gap-3"
                              >
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                                  {index + 1}
                                </div>

                                <div className="flex-1">
                                  <div className="text-xs text-white/75">
                                    {name}
                                  </div>
                                  <div className="h-1.5 w-16 rounded bg-white/10 mt-1.5" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-ink-900/35 mt-4">
                واجهة مصممة لتكون واضحة وسريعة وسهلة الاستخدام
              </p>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="py-20 lg:py-28 bg-white border-y border-sand-200"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center">
              <span className="text-sm font-bold text-gold-600">
                كل أدواتك في مكان واحد
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3">
                منصة كاملة لإدارة نشاطك
              </h2>

              <p className="text-ink-900/55 mt-5 leading-8">
                بدل ما تستخدم عشرات الأدوات المنفصلة، اجمع أهم عمليات
                عملك داخل مساحة عمل واحدة.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-sand-200 bg-sand-50 p-6 hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-ink-950/5 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-ink-950 text-gold-400 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-ink-950 transition-colors">
                    {feature.icon}
                  </div>

                  <h3 className="font-black text-lg mt-6">
                    {feature.title}
                  </h3>

                  <p className="text-sm text-ink-900/55 leading-7 mt-3">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="ryan"
          className="py-20 lg:py-28 bg-ink-950 text-white overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
                  <span className="w-2 h-2 rounded-full bg-gold-400" />
                  RYAN AI
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mt-6">
                  مساعد ذكي يساعدك
                  <br />
                  <span className="text-gold-400">
                    على تحويل المحادثات إلى مبيعات
                  </span>
                </h2>

                <p className="text-white/55 leading-8 mt-6 max-w-xl">
                  RYAN مصمم للتعامل مع العملاء بشكل طبيعي، جمع البيانات
                  المهمة، اكتشاف فرص البيع، ومساعدة فريقك في متابعة العملاء.
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mt-8">
                  {[
                    'ردود ذكية وسريعة',
                    'جمع بيانات العملاء',
                    'تأهيل العملاء المحتملين',
                    'تحويل المحادثات إلى فرص',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        ✓
                      </div>

                      <span className="text-sm text-white/75">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-10 bg-gold-500/10 blur-3xl rounded-full" />

                <div className="relative rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl">
                  <div className="flex items-center gap-3 pb-5 border-b border-white/10">
                    <div className="w-11 h-11 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center font-black">
                      R
                    </div>

                    <div>
                      <div className="font-bold">
                        RYAN AI
                      </div>

                      <div className="text-xs text-emerald-400 mt-1">
                        متصل الآن
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 py-6">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/80">
                      أهلًا بحضرتك، أقدر أساعدك تعرف الخدمات المناسبة
                      لنشاطك.
                    </div>

                    <div className="max-w-[75%] mr-auto rounded-2xl rounded-tl-md bg-gold-500 text-ink-950 p-4 text-sm leading-7">
                      عندي شركة وعايز أزود عدد العملاء.
                    </div>

                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-white/10 p-4 text-sm leading-7 text-white/80">
                      تمام، إيه نوع النشاط بتاع حضرتك؟
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-xs text-white/35">
                    RYAN يجهز الرد...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="py-20 lg:py-28 bg-sand-50"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-sm font-bold text-gold-600">
                طريقة العمل
              </span>

              <h2 className="text-3xl sm:text-4xl font-black mt-3">
                من الفوضى إلى نظام واضح
              </h2>

              <p className="text-ink-900/55 leading-8 mt-5">
                Dragon Media يساعدك تبني دورة عمل واضحة من أول جذب العميل
                وحتى إتمام البيع والمتابعة.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
              {workflow.map((item) => (
                <div
                  key={item.number}
                  className="relative rounded-2xl bg-white border border-sand-200 p-6"
                >
                  <div className="text-5xl font-black text-sand-200">
                    {item.number}
                  </div>

                  <h3 className="font-black text-lg mt-5">
                    {item.title}
                  </h3>

                  <p className="text-sm text-ink-900/55 leading-7 mt-3">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-28 bg-white border-t border-sand-200">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-ink-950 text-white px-7 sm:px-12 py-12 sm:py-16 text-center">
              <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-gold-500/15 blur-3xl" />
              <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative">
                <img
                  src={logoUrl}
                  alt={platformName}
                  className="w-14 h-14 mx-auto rounded-2xl object-contain bg-white/5 p-2"
                />

                <h2 className="text-3xl sm:text-4xl font-black mt-6">
                  جاهز تدير نشاطك بشكل أذكى؟
                </h2>

                <p className="text-white/55 leading-7 mt-4 max-w-xl mx-auto">
                  ابدأ حسابك واستكشف مساحة العمل المصممة لمساعدة نشاطك
                  على النمو.
                </p>

                <Link
                  to="/login?mode=signup"
                  className="inline-flex items-center justify-center gap-2 mt-8 rounded-xl bg-gold-500 text-ink-950 px-7 py-3.5 font-black hover:bg-gold-400 transition-colors"
                >
                  إنشاء حساب
                  <span aria-hidden="true">←</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-sand-200 bg-sand-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt={platformName}
                className="w-9 h-9 rounded-lg object-contain"
              />

              <div>
                <div className="font-bold text-sm">
                  {platformName}
                </div>

                <div className="text-xs text-ink-900/40 mt-1">
                  منصة إدارة العملاء والنمو
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5 text-xs text-ink-900/45">
              <Link
                to="/terms"
                className="hover:text-ink-950"
              >
                شروط الاستخدام
              </Link>

              <Link
                to="/privacy"
                className="hover:text-ink-950"
              >
                سياسة الخصوصية
              </Link>

              <Link
                to="/support"
                className="hover:text-ink-950"
              >
                الدعم
              </Link>
            </div>
          </div>

          <div className="border-t border-sand-200 mt-7 pt-6 text-center text-xs text-ink-900/35">
            © 2026 {platformName}. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  )
}
