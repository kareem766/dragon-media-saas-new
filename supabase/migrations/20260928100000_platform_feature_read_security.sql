drop policy if exists "authenticated_read_platform_features" on public.platform_features;
create policy "authenticated_read_platform_features" on public.platform_features for select to authenticated using (true);
grant select on public.platform_features to authenticated;

create or replace function public.platform_feature_enabled(p_feature text)
returns boolean language sql stable security invoker set search_path=''
as $$ select coalesce((select pf.enabled from public.platform_features pf where pf.feature_key=p_feature),false); $$;

create or replace function public.platform_enabled_features()
returns table(feature_key text)
language sql stable security invoker set search_path=''
as $$ select pf.feature_key from public.platform_features pf where pf.enabled=true order by pf.sort_order,pf.feature_key; $$;