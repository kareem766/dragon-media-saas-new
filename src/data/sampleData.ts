import type {
  Lead, Customer, Deal, ServiceItem, Campaign,
  Conversation, TaskItem, Appointment, Invoice, TeamUser
} from '../types'

export const leads: Lead[] = [
  { id: 'L-001', name: 'أحمد فتحي', company: 'مطعم البيت الدمشقي', phone: '01012345678', source: 'فيسبوك', status: 'جديد', assignedTo: 'مريم صلاح', createdAt: '2026-09-02' },
  { id: 'L-002', name: 'سارة عبد الله', company: 'كلينك دكتور نور', phone: '01198765432', source: 'إنستجرام', status: 'تم التواصل', assignedTo: 'كريم عادل', createdAt: '2026-09-01' },
  { id: 'L-003', name: 'محمود الشريف', company: 'شركة النور للمقاولات', phone: '01234567890', source: 'واتساب', status: 'مهتم', assignedTo: 'مريم صلاح', createdAt: '2026-08-30' },
  { id: 'L-004', name: 'ياسمين طارق', company: 'بوتيك يارا', phone: '01555444333', source: 'موقع إلكتروني', status: 'جديد', assignedTo: 'كريم عادل', createdAt: '2026-08-29' },
  { id: 'L-005', name: 'عمر حسني', company: '—', phone: '01099887766', source: 'إحالة', status: 'غير مهتم', assignedTo: 'مريم صلاح', createdAt: '2026-08-27' },
]

export const customers: Customer[] = [
  { id: 'C-101', name: 'شركة الفا للتجارة', phone: '0223456789', email: 'info@alfa-trade.com', status: 'نشط', totalSpent: 84000, tags: ['عميل ذهبي', 'تجارة إلكترونية'] },
  { id: 'C-102', name: 'صيدليات الشفاء', phone: '01011223344', email: 'contact@shefaa.com', status: 'نشط', totalSpent: 45500, tags: ['صحة'] },
  { id: 'C-103', name: 'مطاعم بيت العز', phone: '01277889900', email: 'hello@ezz-food.com', status: 'غير نشط', totalSpent: 12800, tags: ['مطاعم'] },
]

export const deals: Deal[] = [
  { id: 'D-01', title: 'باقة إدارة سوشيال ميديا سنوية', customer: 'مطعم البيت الدمشقي', value: 36000, stage: 'جديد', owner: 'مريم صلاح', updatedAt: '2026-09-03' },
  { id: 'D-02', title: 'حملة Media Buying رمضان', customer: 'كلينك دكتور نور', value: 22000, stage: 'تم التواصل', owner: 'كريم عادل', updatedAt: '2026-09-02' },
  { id: 'D-03', title: 'بوت خدمة عملاء RYAN', customer: 'شركة النور للمقاولات', value: 15000, stage: 'مهتم', owner: 'مريم صلاح', updatedAt: '2026-09-01' },
  { id: 'D-04', title: 'باقة تصوير وإنتاج فيديو', customer: 'بوتيك يارا', value: 28000, stage: 'عرض سعر', owner: 'كريم عادل', updatedAt: '2026-08-31' },
  { id: 'D-05', title: 'إدارة كاملة + أتمتة تسويقية', customer: 'صيدليات الشفاء', value: 52000, stage: 'تفاوض', owner: 'مريم صلاح', updatedAt: '2026-08-29' },
  { id: 'D-06', title: 'عقد سنوي شامل', customer: 'شركة الفا للتجارة', value: 96000, stage: 'تم التعاقد', owner: 'كريم عادل', updatedAt: '2026-08-20' },
]

export const services: ServiceItem[] = [
  { id: 'S-01', name: 'إدارة صفحات السوشيال ميديا', description: 'إدارة شاملة للمحتوى والتفاعل على جميع المنصات', category: 'سوشيال ميديا', price: 'يبدأ من 6,000 ج.م / شهريًا' },
  { id: 'S-02', name: 'Media Buying', description: 'إدارة وتحسين الحملات الإعلانية المدفوعة', category: 'إعلانات', price: 'عمولة 15% من الميزانية' },
  { id: 'S-03', name: 'Content Creation', description: 'كتابة محتوى إبداعي مصمم خصيصًا لهوية العلامة', category: 'محتوى', price: 'يبدأ من 4,500 ج.م / شهريًا' },
  { id: 'S-04', name: 'Graphic Design', description: 'تصميمات جرافيك احترافية للحملات والمنشورات', category: 'تصميم', price: 'يبدأ من 3,000 ج.م / شهريًا' },
  { id: 'S-05', name: 'Video Production', description: 'إنتاج فيديوهات تسويقية وريلز عالية الجودة', category: 'إنتاج', price: 'حسب المشروع' },
  { id: 'S-06', name: 'SEO', description: 'تحسين ظهور الموقع في نتائج البحث', category: 'تحسين محركات البحث', price: 'يبدأ من 5,000 ج.م / شهريًا' },
  { id: 'S-07', name: 'AI Customer Service', description: 'خدمة عملاء ذكية تعمل على مدار الساعة عبر RYAN AI', category: 'ذكاء اصطناعي', price: 'يبدأ من 8,000 ج.م / شهريًا' },
  { id: 'S-08', name: 'Chatbots', description: 'بناء شات بوت مخصص للرد الفوري على العملاء', category: 'ذكاء اصطناعي', price: 'حسب المشروع' },
  { id: 'S-09', name: 'Marketing Automation', description: 'أتمتة رحلة العميل من أول تواصل لحد التحويل', category: 'أتمتة', price: 'يبدأ من 7,000 ج.م / شهريًا' },
]

export const campaigns: Campaign[] = [
  { id: 'CMP-01', name: 'عروض العودة للمدارس', channel: 'واتساب', audience: 'عملاء نشطون - آخر 90 يوم', status: 'قيد التنفيذ', sentCount: 1240, openRate: 61, scheduledAt: '2026-09-01' },
  { id: 'CMP-02', name: 'تذكير بتجديد الاشتراك', channel: 'بريد إلكتروني', audience: 'اشتراكات تنتهي خلال أسبوع', status: 'مجدولة', sentCount: 0, openRate: 0, scheduledAt: '2026-09-10' },
  { id: 'CMP-03', name: 'إطلاق خدمة الأتمتة التسويقية', channel: 'فيسبوك', audience: 'متابعين + عملاء محتملين', status: 'مكتملة', sentCount: 8600, openRate: 34, scheduledAt: '2026-08-15' },
]

export const conversations: Conversation[] = [
  { id: 'CV-01', customerName: 'أحمد فتحي', channel: 'واتساب', lastMessage: 'ممكن أعرف تفاصيل باقة السوشيال ميديا؟', time: '10:24 ص', unread: true, handledBy: 'RYAN AI' },
  { id: 'CV-02', customerName: 'سارة عبد الله', channel: 'ماسنجر', lastMessage: 'تمام هبعتلكم الشعار دلوقتي', time: '09:58 ص', unread: false, handledBy: 'موظف' },
  { id: 'CV-03', customerName: 'ياسمين طارق', channel: 'إنستجرام', lastMessage: 'شكرًا على سرعة الرد 🙏', time: 'أمس', unread: false, handledBy: 'RYAN AI' },
  { id: 'CV-04', customerName: 'محمود الشريف', channel: 'الموقع', lastMessage: 'عايز أحجز استشارة مع فريق المبيعات', time: 'أمس', unread: true, handledBy: 'RYAN AI' },
]

export const tasks: TaskItem[] = [
  { id: 'T-01', title: 'متابعة عرض السعر مع بوتيك يارا', assignedTo: 'كريم عادل', dueDate: '2026-09-05', priority: 'عالية', status: 'قيد التنفيذ' },
  { id: 'T-02', title: 'تجهيز تقرير أداء حملة رمضان', assignedTo: 'مريم صلاح', dueDate: '2026-09-06', priority: 'متوسطة', status: 'قيد التنفيذ' },
  { id: 'T-03', title: 'مراجعة عقد شركة الفا للتجارة', assignedTo: 'مريم صلاح', dueDate: '2026-09-02', priority: 'عالية', status: 'متأخرة' },
  { id: 'T-04', title: 'تحديث المحتوى المعرفي لـ RYAN', assignedTo: 'كريم عادل', dueDate: '2026-09-08', priority: 'منخفضة', status: 'قيد التنفيذ' },
]

export const appointments: Appointment[] = [
  { id: 'AP-01', customer: 'صيدليات الشفاء', service: 'استشارة أتمتة تسويقية', date: '2026-09-05', time: '01:00 م', status: 'مؤكد' },
  { id: 'AP-02', customer: 'مطعم البيت الدمشقي', service: 'عرض تقديمي - باقة سوشيال ميديا', date: '2026-09-06', time: '11:30 ص', status: 'قيد الانتظار' },
  { id: 'AP-03', customer: 'كلينك دكتور نور', service: 'مراجعة أداء الحملة', date: '2026-09-07', time: '03:00 م', status: 'مؤكد' },
]

export const invoices: Invoice[] = [
  { id: 'INV-2026-014', customer: 'شركة الفا للتجارة', plan: 'باقة النمو السنوية', amount: 96000, status: 'مدفوعة', dueDate: '2026-08-20' },
  { id: 'INV-2026-015', customer: 'صيدليات الشفاء', plan: 'باقة الأتمتة الشهرية', amount: 7000, status: 'قيد الانتظار', dueDate: '2026-09-10' },
  { id: 'INV-2026-016', customer: 'مطاعم بيت العز', plan: 'باقة سوشيال ميديا', amount: 6000, status: 'متأخرة', dueDate: '2026-08-25' },
]

export const teamUsers: TeamUser[] = [
  { id: 'U-01', name: 'كريم عادل', role: 'مدير عام', email: 'kareem@dragonmedia.com', active: true },
  { id: 'U-02', name: 'مريم صلاح', role: 'مبيعات', email: 'mariam@dragonmedia.com', active: true },
  { id: 'U-03', name: 'يوسف نبيل', role: 'خدمة عملاء', email: 'youssef@dragonmedia.com', active: true },
  { id: 'U-04', name: 'هبة الزيات', role: 'أدمن', email: 'heba@dragonmedia.com', active: false },
]

export const pipelineStages: Deal['stage'][] = [
  'جديد', 'تم التواصل', 'مهتم', 'عرض سعر', 'تفاوض', 'تم التعاقد', 'مغلق - خسرنا'
]
