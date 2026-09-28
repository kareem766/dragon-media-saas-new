update public.subscriptions s
set features_snapshot=coalesce(p.features,'{}'::jsonb),
    limits_snapshot=coalesce(p.limits,'{}'::jsonb)
from public.plans p
where s.plan_id=p.id
  and (s.features_snapshot is null or s.limits_snapshot is null);