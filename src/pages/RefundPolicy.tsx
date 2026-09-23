import React from 'react'
import { Link } from 'react-router-dom'

const CONTACT_PHONE = '01096656281'
const CONTACT_EMAIL = 'kalnoby0@gmail.com'
const COMPANY_ADDRESS = 'الإسكندرية - مصر'

export default function RefundPolicy() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-[#f7faff] via-white to-[#fffaf1] text-ink-900 px-5 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-blue-100/80 bg-white/90 shadow-[0_12px_34px_rgba(15,47,107,0.05)] backdrop-blur-sm overflow-hidden">
          <div className="border-b border-sand-200 px-6 py-7 sm:px-8">
            <p className="text-sm font-bold text-gold-600">Dragon Media</p>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">سياسة الاسترجاع واسترداد الأموال</h1>
            <p className="text-sm text-ink-900/50 mt-2">آخر تحديث: 17 سبتمبر 2026</p>
          </div>

          <div className="px-6 py-7 sm:px-8 space-y-7 text-sm leading-8 text-ink-900/75">
            <section>
              <h2 className="font-black text-lg text-ink-950">1. نطاق السياسة</h2>
              <p className="mt-2">
                توضح هذه السياسة الحالات والإجراءات الخاصة بطلبات استرداد المبالغ المدفوعة مقابل الاشتراكات والخدمات المتاحة عبر منصة Dragon Media.
              </p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">2. متى يمكن طلب الاسترداد؟</h2>
              <p className="mt-2">
                يمكن للعميل تقديم طلب استرداد خلال 7 أيام من تاريخ تفعيل الاشتراك، بشرط ألا يكون قد تم استخدام الخدمة استخدامًا جوهريًا خلال الفترة المطلوب استردادها.
              </p>
              <p className="mt-2">
                كما يمكن النظر في طلبات الاسترداد في حالات الدفع المكرر أو الدفع بالخطأ أو وجود مشكلة جوهرية في توفير الخدمة من جانب Dragon Media، بحسب الحالة.
              </p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">3. الحالات غير القابلة للاسترداد</h2>
              <p className="mt-2">
                لا يتم عادةً استرداد قيمة الفترة التي تم استخدامها بالفعل، كما لا تُسترد المبالغ مقابل الاستخدام الفعلي للميزات أو الخدمات خلال فترة الاشتراك، مع مراعاة أي حالة استثنائية يتم اعتمادها بعد المراجعة.
              </p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">4. طريقة تقديم الطلب</h2>
              <p className="mt-2">
                لإرسال طلب استرداد، تواصل معنا عبر الهاتف أو البريد الإلكتروني مع اسم الشركة، بيانات التواصل، رقم العملية أو المرجع، سبب طلب الاسترداد، وأي مستندات أو تفاصيل تساعد في مراجعة الطلب.
              </p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">5. مراجعة ومعالجة الطلب</h2>
              <p className="mt-2">
                تتم مراجعة طلبات الاسترداد والتحقق من بيانات العملية وحالة الاشتراك والاستخدام الفعلي للخدمة قبل اتخاذ القرار. في حال الموافقة، يتم تنفيذ الاسترداد من خلال وسيلة الدفع المناسبة أو وفق آلية مزود الدفع، وقد تختلف مدة ظهور المبلغ بحسب البنك أو مزود خدمة الدفع.
              </p>
              <p className="mt-2">
                أي رسوم دفع أو تحويل غير قابلة للاسترداد من البنك أو مزود الدفع قد تُعامل وفق شروط مزود الخدمة والقواعد المعمول بها.
              </p>
            </section>

            <section>
              <h2 className="font-black text-lg text-ink-950">6. إلغاء الاشتراك</h2>
              <p className="mt-2">
                يمكن للعميل إلغاء التجديد أو طلب إيقاف الاشتراك وفق حالة حسابه. إلغاء الاشتراك لا يعني تلقائيًا استرداد المبالغ المدفوعة عن فترة سابقة تم تفعيلها أو استخدامها.
              </p>
            </section>

            <section className="rounded-2xl border border-sand-200 bg-sand-50 p-5">
              <h2 className="font-black text-base text-ink-950">بيانات التواصل</h2>
              <div className="mt-3 space-y-2">
                <div>مقر الشركة: {COMPANY_ADDRESS}</div>
                <div>الهاتف: <a href={`tel:${CONTACT_PHONE}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_PHONE}</a></div>
                <div>البريد الإلكتروني: <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-semibold text-ink-950 hover:underline">{CONTACT_EMAIL}</a></div>
              </div>
            </section>
          </div>

          <div className="border-t border-sand-200 px-6 py-5 sm:px-8 flex flex-wrap gap-4 text-sm">
            <Link to="/terms" className="font-semibold text-ink-900 hover:underline">الشروط والأحكام</Link>
            <Link to="/privacy" className="font-semibold text-ink-900 hover:underline">سياسة الخصوصية</Link>
            <Link to="/support" className="font-semibold text-ink-900 hover:underline">تواصل معنا</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
