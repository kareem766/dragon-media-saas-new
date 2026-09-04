export type LeadStatus = 'جديد' | 'تم التواصل' | 'مهتم' | 'غير مهتم'

export interface Lead {
  id: string
  name: string
  company?: string
  phone: string
  source: string
  status: LeadStatus
  assignedTo: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  company?: string
  phone: string
  email?: string
  status: 'نشط' | 'غير نشط'
  totalSpent: number
  tags: string[]
}

export type DealStage =
  | 'جديد'
  | 'تم التواصل'
  | 'مهتم'
  | 'عرض سعر'
  | 'تفاوض'
  | 'تم التعاقد'
  | 'مغلق - خسرنا'

export interface Deal {
  id: string
  title: string
  customer: string
  value: number
  stage: DealStage
  owner: string
  updatedAt: string
}

export interface ServiceItem {
  id: string
  name: string
  description: string
  category: string
  price: string
}

export interface Campaign {
  id: string
  name: string
  channel: 'واتساب' | 'فيسبوك' | 'إنستجرام' | 'بريد إلكتروني'
  audience: string
  status: 'مجدولة' | 'قيد التنفيذ' | 'مكتملة' | 'متوقفة'
  sentCount: number
  openRate: number
  scheduledAt: string
}

export interface Conversation {
  id: string
  customerName: string
  channel: 'واتساب' | 'ماسنجر' | 'إنستجرام' | 'تليجرام' | 'الموقع'
  lastMessage: string
  time: string
  unread: boolean
  handledBy: 'RYAN AI' | 'موظف'
}

export interface TaskItem {
  id: string
  title: string
  assignedTo: string
  dueDate: string
  priority: 'عالية' | 'متوسطة' | 'منخفضة'
  status: 'قيد التنفيذ' | 'مكتملة' | 'متأخرة'
}

export interface Appointment {
  id: string
  customer: string
  service: string
  date: string
  time: string
  status: 'مؤكد' | 'قيد الانتظار' | 'ملغي'
}

export interface Invoice {
  id: string
  customer: string
  plan: string
  amount: number
  status: 'مدفوعة' | 'قيد الانتظار' | 'متأخرة'
  dueDate: string
}

export interface TeamUser {
  id: string
  name: string
  role: 'مدير عام' | 'أدمن' | 'مبيعات' | 'خدمة عملاء' | 'موظف'
  email: string
  active: boolean
}
