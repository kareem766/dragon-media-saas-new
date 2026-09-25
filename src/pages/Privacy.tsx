import React from 'react'
import { Link } from 'react-router-dom'

const CONTACT_PHONE = '01096656281'
const CONTACT_EMAIL = 'kalnoby0@gmail.com'
const COMPANY_ADDRESS = 'الإسكندرية - مصر'

export default function Privacy() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-[#f7faff] via-white to-[#fffaf1] text-ink-900 px-5 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="overflow-hidden rounded-[2rem] border border-blue-100/80 bg-white/90 shadow-[0_25px_70px_rgba(15,47,107,0.08)] backdrop-blur-xl">
          <div className="border-b border-sand-200 bg-gradient-to-r from-blue-50/70 via-white to-amber-50/50 px-6 py-7 sm:px-8"><p className="text-sm font-bold text-gold-600">Dragon Media</p><h1 className="text-2xl sm:text-3xl font-black mt-2">سياسة الخصوصية</h1><p className="text-sm text-ink-900/50 mt-2">آخر تحديث: 17 سبتمبر 2026</p></div>
          <div className="px-6 py-7 sm:px-8 space-y-6 text-sm leading-8 text-ink-900/75">
            <p>تحترم منصة Dragon Media خصوصية مستخدميها. توضح هذه السياسة كيفية جمعنا واستخدامنا وحمايتنا للبيانات المرتبطة باستخدام المنصة.</p>
            <section><h2 className="font-black text-lg text-ink-950">البيانات التي نجمعها</h2><p className="mt-2">قد نجمع اسم الشركة، بيانات التواصل، بيانات المستخدمين والعملاء التي يتم إدخالها في النظام، وبيانات القنوات المتصلة مثل فيسبوك وإنستجرام وواتساب عند ربطها اختياريًا.</p></section>
            <section><h2 className="font-black text-lg text-ink-950">كيف نستخدم بياناتك</h2><p className="mt-2">نستخدم البيانات لتشغيل وتحسين خدمات Dragon Media وإتاحة إدارة العملاء والمحادثات والحملات والأتمتة والتقارير والميزات المرتبطة بحسابك. لا نبيع بيانات العملاء أو بيانات حسابك لأغراض تسويقية.</p></section>
            <section><h2 className="font-black text-lg text-ink-950">عزل البيانات وأمانها</h2><p className="mt-2">تُدار بيانات كل شركة داخل مساحة عملها المخصصة، مع تطبيق ضوابط وصول لحماية البيانات من الوصول غير المصرح به. يتم الاحتفاظ بالبيانات بالقدر اللازم لتقديم الخدمة أو وفق المتطلبات التشغيلية والقانونية ذات الصلة.</p></section>
            <section><h2 className="font-black text-lg text-ink-950">ربط حسابات التواصل الاجتماعي</h2><p className="mt-2">عند ربط حسابك على فيسبوك أو إنستجرام أو واتساب، نستخدم الصلاحيات الممنوحة واللازمة لتقديم الميزات التي طلبتها، مثل استقبال الرسائل وإرسال الردود وإدارة المحادثات. يمكنك إلغاء الربط من إعدادات الحساب أو من المنصة الخارجية وفق أدواتها المتاحة.</p></section>
            <section><h2 className="font-black text-lg text-ink-950">حذف البيانات</h2><p className="mt-2">يمكنك طلب حذف حسابك أو بياناتك المرتبطة بالخدمة عبر التواصل معنا. قد نحتفظ ببعض السجلات عندما يكون ذلك ضروريًا للمتطلبات المحاسبية أو القانونية أو لمنع إساءة الاستخدام.</p></section>
            <section><h2 className="font-black text-lg text-ink-950">التواصل</h2><div className="mt-2 space-y-2"><div>مقر الشركة: {COMPANY_ADDRESS}</div><div>الهاتف: <a href={`tel:${CONTACT_PHONE}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_PHONE}</a></div><div>البريد الإلكتروني: <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_EMAIL}</a></div></div></section>
          </div>
          <div className="border-t border-sand-200 px-6 py-5 sm:px-8 flex flex-wrap items-center gap-3 text-sm">
            <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">العودة إلى المنصة <span aria-hidden="true">←</span></Link>
            <Link to="/terms" className="font-semibold text-ink-900 hover:underline">الشروط والأحكام</Link><Link to="/refund-policy" className="font-semibold text-ink-900 hover:underline">سياسة الاسترجاع</Link><Link to="/support" className="font-semibold text-ink-900 hover:underline">تواصل معنا</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
