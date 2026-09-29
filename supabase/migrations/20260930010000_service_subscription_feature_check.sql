create or replace function public.service_subscription_has_feature(p_organization_id uuid,p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_organization_id is null or p_feature is null or btrim(p_feature)='' then false
    when coalesce((select o.suspended from public.organizations o where o.id=p_organization_id),false) then false
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
$$;

revoke all on function public.service_subscription_has_feature(uuid,text) from public, anon, authenticated;
grant execute on function public.service_subscription_has_feature(uuid,text) to service_role;
