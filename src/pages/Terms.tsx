import React from 'react'
import { Link } from 'react-router-dom'

const CONTACT_PHONE = '01096656281'
const CONTACT_EMAIL = 'kalnoby0@gmail.com'
const COMPANY_ADDRESS = 'الإسكندرية - مصر'

export default function Terms() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-[#f7faff] via-white to-[#fffaf1] text-ink-900 px-5 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-blue-100/80 bg-white/90 shadow-[0_12px_34px_rgba(15,47,107,0.05)] backdrop-blur-sm overflow-hidden">
          <div className="border-b border-sand-200 px-6 py-7 sm:px-8">
            <p className="text-sm font-bold text-gold-600">Dragon Media</p>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">شروط الاستخدام</h1>
            <p className="text-sm text-ink-900/50 mt-2">آخر تحديث: 17 سبتمبر 2026</p>
          </div>

          <div className="px-6 py-7 sm:px-8 space-y-6 text-sm leading-8 text-ink-900/75">
            <p>باستخدامك لمنصة Dragon Media أو إنشاء حساب عليها، فإنك توافق على الالتزام بهذه الشروط.</p>

            <section>
              <h2 className="font-black text-lg text-ink-950">استخدام الخدمة</h2>
              <p className="mt-2">تُستخدم المنصة لإدارة العملاء والمبيعات والتواصل والأتمتة الخاصة بنشاطك التجاري. يُمنع استخدامها لأي غرض غير قانوني أو مسيء أو ينتهك حقوق الغير.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">الحسابات والمسؤولية</h2>
              <p className="mt-2">أنت مسؤول عن الحفاظ على سرية بيانات دخولك، وعن الأنشطة التي تتم عبر حسابك، وعن دقة البيانات التي تقدمها أثناء التسجيل أو استخدام الخدمة.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">الاشتراكات والمدفوعات</h2>
              <p className="mt-2">تبدأ الاستفادة من الميزات المدفوعة وفق حالة الاشتراك والخطة المحددة في حسابك، وبعد استكمال إجراءات الدفع والمراجعة المطلوبة. تفاصيل الأسعار والميزات والحدود تظهر في صفحة الخطط.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">الاسترجاع والإلغاء</h2>
              <p className="mt-2">تخضع طلبات الاسترداد والإلغاء لسياسة الاسترجاع واسترداد الأموال المنشورة على الموقع.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">القنوات المتصلة</h2>
              <p className="mt-2">عند ربط حسابات التواصل الاجتماعي الخاصة بك، فإنك تمنح Dragon Media الصلاحيات اللازمة للميزات التي طلبتها. أنت مسؤول عن امتلاك الصلاحيات المناسبة لإدارة الحسابات والصفحات والقنوات التي تقوم بربطها.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">التعديلات</h2>
              <p className="mt-2">قد يتم تحديث هذه الشروط أو تعديل بعض الميزات والخدمات من وقت لآخر. سيتم نشر النسخة المحدثة على الموقع، وقد يتم إخطار المستخدم بالتغييرات الجوهرية عبر القنوات المتاحة في حسابه.</p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">التواصل</h2>
              <div className="mt-2 space-y-2">
                <div>مقر الشركة: {COMPANY_ADDRESS}</div>
                <div>الهاتف: <a href={`tel:${CONTACT_PHONE}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_PHONE}</a></div>
                <div>البريد الإلكتروني: <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_EMAIL}</a></div>
              </div>
            </section>
          </div>

          <div className="border-t border-sand-200 px-6 py-5 sm:px-8 flex flex-wrap gap-4 text-sm">
            <Link to="/privacy" className="font-semibold text-ink-900 hover:underline">سياسة الخصوصية</Link>
            <Link to="/refund-policy" className="font-semibold text-ink-900 hover:underline">سياسة الاسترجاع</Link>
            <Link to="/support" className="font-semibold text-ink-900 hover:underline">تواصل معنا</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
