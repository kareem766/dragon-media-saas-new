-- ============================================================
-- Dragon Media — Supabase Schema (Multi-tenant SaaS)
-- كل جدول مرتبط بـ organization_id لعزل بيانات كل شركة (tenant)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- المؤسسات (Tenants) ----------
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  phone text,
  email text,
  timezone text default 'Africa/Cairo',
  plan text default 'أساسي',
  created_at timestamptz default now()
);

-- ---------- المستخدمون والأدوار ----------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('super_admin','admin','sales','support','employee')),
  active boolean default true,
  created_at timestamptz default now()
);

create table roles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text
);

create table permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid references roles(id) on delete cascade,
  resource text not null,
  can_view boolean default false,
  can_edit boolean default false,
  can_delete boolean default false
);

-- ---------- CRM ----------
create table customers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  company text,
  phone text,
  email text,
  status text default 'نشط',
  total_spent numeric default 0,
  tags text[],
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  company text,
  phone text,
  source text,
  status text default 'جديد',
  assigned_to uuid references users(id),
  notes text,
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  name text,
  phone text,
  email text,
  is_primary boolean default false
);

-- ---------- مسار المبيعات ----------
create table pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  order_index int not null
);

create table deals (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  title text not null,
  customer_id uuid references customers(id),
  value numeric default 0,
  stage_id uuid references pipeline_stages(id),
  owner_id uuid references users(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ---------- الخدمات ----------
create table services (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price text
);

-- ---------- الحملات ----------
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  channel text check (channel in ('whatsapp','messenger','instagram','email')),
  audience text,
  status text default 'مجدولة',
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table campaign_messages (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  customer_id uuid references customers(id),
  status text default 'قيد الإرسال',
  sent_at timestamptz,
  opened_at timestamptz,
  opt_in boolean default true
);

-- ---------- المحادثات (Omnichannel Inbox) ----------
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  customer_id uuid references customers(id),
  channel text check (channel in ('whatsapp','messenger','instagram','telegram','website')),
  handled_by text default 'ai' check (handled_by in ('ai','human')),
  assigned_user_id uuid references users(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_type text check (sender_type in ('customer','ai','agent')),
  content text not null,
  created_at timestamptz default now()
);

-- ---------- RYAN AI ----------
create table ai_agents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text default 'RYAN',
  persona text,
  language text default 'egyptian_arabic',
  active boolean default true
);

create table knowledge_base (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  ai_agent_id uuid references ai_agents(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

-- ---------- المهام والمواعيد ----------
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  title text not null,
  assigned_to uuid references users(id),
  due_date date,
  priority text default 'متوسطة',
  status text default 'قيد التنفيذ'
);

create table appointments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  customer_id uuid references customers(id),
  service_id uuid references services(id),
  appointment_date date,
  appointment_time time,
  status text default 'قيد الانتظار',
  notes text
);

-- ---------- الاشتراكات والفوترة ----------
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  plan text not null,
  status text default 'نشط',
  renewal_date date
);

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  subscription_id uuid references subscriptions(id),
  amount numeric not null,
  status text default 'قيد الانتظار',
  due_date date
);

create table payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric not null,
  method text,
  paid_at timestamptz default now()
);

-- ---------- الإشعارات والتكاملات ----------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id),
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

create table integrations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  provider text not null,
  connected boolean default false,
  config jsonb,
  updated_at timestamptz default now()
);

-- ============================================================
-- Row Level Security — عزل بيانات كل مؤسسة (Tenant Isolation)
-- ============================================================
alter table customers enable row level security;
alter table leads enable row level security;
alter table deals enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table tasks enable row level security;
alter table appointments enable row level security;
alter table invoices enable row level security;

create policy "tenant_isolation_customers" on customers
  for all using (
    organization_id = (select organization_id from users where id = auth.uid())
  );

create policy "tenant_isolation_leads" on leads
  for all using (
    organization_id = (select organization_id from users where id = auth.uid())
  );

create policy "tenant_isolation_deals" on deals
  for all using (
    organization_id = (select organization_id from users where id = auth.uid())
  );

-- كر
