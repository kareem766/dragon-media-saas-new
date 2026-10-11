-- Give the platform owner a dedicated, non-public, unlimited subscription.
-- Do not change any customer-facing plan or its entitlements.
insert into public.plans (name, price, currency, billing_cycle, features, limits, trial_days, status, sort_order, yearly_price, is_popular, tagline)
select
  'إدارة المنصة - غير محدود',
  0,
  'EGP',
  'yearly',
  coalesce((select jsonb_object_agg(feature_key, true) from public.platform_features where feature_key <> 'users'), '{}'::jsonb),
  jsonb_build_object('users',2147483647,'customers',2147483647,'ai_messages',2147483647),
  0,
  'disabled',
  9999,
  0,
  false,
  'خطة داخلية لحساب مالك المنصة فقط'
where not exists (select 1 from public.plans where name='إدارة المنصة - غير محدود');

update public.subscriptions s
set plan_id=p.id,
    plan='إدارة المنصة - غير محدود',
    status='active',
    started_at=coalesce(s.started_at,current_date),
    expires_at='2999-12-31',
    renewal_date='2999-12-31',
    billing_cycle='yearly',
    features_snapshot=p.features,
    limits_snapshot=p.limits
from public.plans p
where p.name='إدارة المنصة - غير محدود'
  and exists (
    select 1 from public.users u
    where u.organization_id=s.organization_id
      and u.is_platform_admin=true
      and u.active=true
  );

create or replace function public.subscription_has_feature(p_organization_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when auth.uid() is null or p_organization_id is null then false
    when p_organization_id <> public.current_organization_id() then false
    when p_feature is null or btrim(p_feature) = '' then false
    when coalesce((select o.suspended from public.organizations o where o.id=p_organization_id),true) then false
    when exists (
      select 1 from public.users u
      where u.id=auth.uid()
        and u.organization_id=p_organization_id
        and u.is_platform_admin=true
        and u.active=true
    ) then true
    when not public.subscription_is_active(p_organization_id) then false
    when not public.platform_feature_enabled(p_feature) then false
    else exists (
      select 1 from public.subscriptions s
      join public.plan_entitlements e on e.plan_id=s.plan_id
      where s.organization_id=p_organization_id
        and s.status in ('active','trialing')
        and s.expires_at >= current_date
        and e.entitlement_type='feature'
        and e.entitlement_key=p_feature
        and e.enabled=true
    )
  end;
$function$;

create or replace function public.service_subscription_has_feature(p_organization_id uuid,p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_organization_id is null or p_feature is null or btrim(p_feature)='' then false
    when coalesce((select o.suspended from public.organizations o where o.id=p_organization_id),false) then false
    when exists (
      select 1 from public.users u
      where u.organization_id=p_organization_id
        and u.is_platform_admin=true
        and u.active=true
    ) then true
    when not coalesce((select pf.enabled from public.platform_features pf where pf.feature_key=p_feature),false) then false
    else exists (
      select 1
      from public.subscriptions s
      join public.plan_entitlements e on e.plan_id=s.plan_id
      where s.organization_id=p_organization_id
        and s.status in ('active','trialing')
        and s.started_at is not null
        and s.expires_at is not null
        and s.started_at <= current_date
        and s.expires_at >= current_date
        and e.entitlement_type='feature'
        and e.entitlement_key=p_feature
        and e.enabled=true
    )
  end;
$function$;

revoke all on function public.service_subscription_has_feature(uuid,text) from public, anon, authenticated;
grant execute on function public.service_subscription_has_feature(uuid,text) to service_role;
