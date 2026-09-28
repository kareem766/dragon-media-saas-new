-- Platform-wide feature control and complete plan entitlement registry
create table if not exists public.platform_features (
  feature_key text primary key,
  label text not null,
  description text not null default '',
  category text not null default 'platform',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.platform_features enable row level security;
revoke all on public.platform_features from anon, authenticated;

insert into public.platform_features(feature_key,label,description,category,enabled,sort_order)
values
('dashboard','الرئيسية','لوحة الشركة والنظرة العامة','أساسي',true,10),
('crm','إدارة العملاء CRM','العملاء والعملاء المحتملون ومسار المبيعات','مبيعات',true,20),
('services','الخدمات','إدارة خدمات الشركة وعروضها','أساسي',true,30),
('campaigns','الحملات التسويقية','إنشاء وإدارة الحملات التسويقية','تسويق',true,40),
('ai_content','استوديو المحتوى بالـAI','إنشاء محتوى احترافي بالذكاء الاصطناعي','ذكاء اصطناعي',true,50),
('inbox','صندوق المحادثات الموحد','إدارة المحادثات الواردة من القنوات المتصلة','تواصل',true,60),
('ryan','RYAN AI','المساعد الذكي للمبيعات وخدمة العملاء','ذكاء اصطناعي',true,70),
('automations','الأتمتة','تشغيل السيناريوهات والإجراءات التلقائية','أتمتة',true,80),
('tasks','المهام والمتابعات','إدارة المهام والمتابعات','إدارة',true,90),
('appointments','المواعيد','إدارة المواعيد والحجوزات','إدارة',true,100),
('reports','التقارير','التقارير والتحليلات','تحليلات',true,110),
('users','المستخدمون والصلاحيات','إدارة أعضاء الشركة وصلاحياتهم','إدارة',true,120),
('integrations','التكاملات','ربط Facebook وInstagram وWhatsApp والقنوات المتاحة','تكاملات',true,130),
('tickets','الدعم الفني','تذاكر الدعم الفني','دعم',true,140),
('billing','الفواتير والاشتراكات','الفواتير والاشتراكات وطلبات الدفع','مالية',true,150),
('settings','إعدادات الشركة','إعدادات الشركة والحساب','أساسي',true,160),
('advanced_reports','التقارير المتقدمة','التقارير والتحليلات المتقدمة','تحليلات',true,111),
('ai_image_generation','توليد الصور بالذكاء الاصطناعي','توليد الصور بالذكاء الاصطناعي عند إتاحته','ذكاء اصطناعي',true,112)
on conflict (feature_key) do update set label=excluded.label, description=excluded.description, category=excluded.category, sort_order=excluded.sort_order;

update public.plans
set features = coalesce(features,'{}'::jsonb)
  || jsonb_build_object('services',true,'ai_content',true,'inbox',true,'tasks',true,'billing',true,'tickets',true,'settings',true,'campaigns',coalesce(features->>'campaigns','false')::boolean,'dashboard',true,'appointments',true,'integrations',true);

create or replace function public.platform_feature_enabled(p_feature text)
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select pf.enabled from public.platform_features pf where pf.feature_key=p_feature),false); $$;

create or replace function public.platform_enabled_features()
returns table(feature_key text)
language sql stable security definer set search_path=''
as $$ select pf.feature_key from public.platform_features pf where pf.enabled=true order by pf.sort_order,pf.feature_key; $$;

revoke all on function public.platform_feature_enabled(text) from public,anon;
revoke all on function public.platform_enabled_features() from public,anon;
grant execute on function public.platform_feature_enabled(text) to authenticated;
grant execute on function public.platform_enabled_features() to authenticated;

create or replace function public.subscription_has_feature(p_organization_id uuid,p_feature text)
returns boolean language sql stable security definer set search_path=''
as $$
select case
when not public.subscription_is_active(p_organization_id) then false
when p_feature is null or btrim(p_feature)='' then false
when not public.platform_feature_enabled(p_feature) then false
else exists (
select 1 from public.subscriptions s
join public.plan_entitlements e on e.plan_id=s.plan_id
where s.organization_id=p_organization_id and s.status in ('active','trialing') and s.expires_at>=current_date
and e.entitlement_type='feature' and e.entitlement_key=p_feature and e.enabled=true)
end;
$$;

insert into public.plan_entitlements(plan_id,entitlement_key,entitlement_type,value,enabled)
select p.id,x.key,'feature',to_jsonb(x.value),coalesce(x.value::boolean,true)
from public.plans p cross join lateral jsonb_each_text(coalesce(p.features,'{}'::jsonb)) x
on conflict(plan_id,entitlement_key) do update set value=excluded.value,enabled=excluded.enabled,updated_at=now();