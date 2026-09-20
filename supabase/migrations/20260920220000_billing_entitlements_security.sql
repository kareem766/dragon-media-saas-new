-- Durable plan entitlements and billing security hardening
create table if not exists public.plan_entitlements (
  plan_id uuid not null references public.plans(id) on delete cascade,
  entitlement_key text not null,
  entitlement_type text not null check (entitlement_type in ('feature','limit')),
  value jsonb not null default 'null'::jsonb,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan_id, entitlement_key)
);

alter table public.plan_entitlements enable row level security;
revoke all on public.plan_entitlements from anon, authenticated;

create or replace function public.sync_plan_entitlements()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  delete from public.plan_entitlements where plan_id = new.id;

  insert into public.plan_entitlements(plan_id, entitlement_key, entitlement_type, value, enabled)
  select new.id, key, 'feature', to_jsonb(value), coalesce(value::boolean,true)
  from jsonb_each_text(coalesce(new.features,'{}'::jsonb));

  insert into public.plan_entitlements(plan_id, entitlement_key, entitlement_type, value, enabled)
  select new.id, key, 'limit', value, true
  from jsonb_each(coalesce(new.limits,'{}'::jsonb));

  return new;
end;
$$;

drop trigger if exists trg_sync_plan_entitlements on public.plans;
create trigger trg_sync_plan_entitlements
after insert or update of features, limits on public.plans
for each row execute function public.sync_plan_entitlements();

insert into public.plan_entitlements(plan_id, entitlement_key, entitlement_type, value, enabled)
select p.id, x.key, 'feature', to_jsonb(x.value), coalesce(x.value::boolean,true)
from public.plans p
cross join lateral jsonb_each_text(coalesce(p.features,'{}'::jsonb)) x
on conflict (plan_id, entitlement_key)
do update set value=excluded.value, enabled=excluded.enabled, updated_at=now();

insert into public.plan_entitlements(plan_id, entitlement_key, entitlement_type, value, enabled)
select p.id, x.key, 'limit', x.value, true
from public.plans p
cross join lateral jsonb_each(coalesce(p.limits,'{}'::jsonb)) x
on conflict (plan_id, entitlement_key)
do update set value=excluded.value, enabled=true, updated_at=now();

create or replace function public.subscription_has_feature(p_organization_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when not public.subscription_is_active(p_organization_id) then false
    when p_feature is null or btrim(p_feature) = '' then false
    else exists (
      select 1
      from public.subscriptions s
      join public.plan_entitlements e on e.plan_id=s.plan_id
      where s.organization_id=p_organization_id
        and s.status in ('active','trialing')
        and s.expires_at >= current_date
        and e.entitlement_type='feature'
        and e.entitlement_key=p_feature
        and e.enabled=true
    )
  end;
$$;

revoke all on public.meta_delivery_events,
  public.system_secrets,
  public.whatsapp_subscription_notifications,
  public.whatsapp_test_messages
from anon, authenticated;
