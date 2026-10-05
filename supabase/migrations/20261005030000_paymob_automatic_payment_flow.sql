-- Paymob checkout is an automatic payment flow; manual review is only for manual transfers.

alter table public.payment_requests
  drop constraint if exists payment_requests_status_check;

alter table public.payment_requests
  add constraint payment_requests_status_check
  check (status = any (array[
    'pending_review'::text,
    'pending_payment'::text,
    'approved'::text,
    'rejected'::text
  ]));

create or replace function public.notify_platform_admins_on_payment_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  org_name text;
  plan_name text;
  currency_name text;
  notification_title text;
  notification_body text;
  is_renewal boolean := false;
begin
  -- Paymob is fully automated. It must never create a manual-review notification.
  if lower(coalesce(new.method, '')) = 'paymob' then
    return new;
  end if;

  if new.status is distinct from 'pending_review' then
    return new;
  end if;

  select o.name into org_name
  from public.organizations o
  where o.id = new.organization_id;

  select p.name, p.currency
    into plan_name, currency_name
  from public.plans p
  where p.id = new.plan_id;

  if new.request_type = 'ryan_credits' then
    notification_title := 'طلب شراء باقة Ryan جديد';
    notification_body := format(
      'شركة %s أرسلت طلب شراء/زيادة رصيد Ryan بقيمة %s %s، ويحتاج مراجعة.',
      coalesce(org_name, 'غير معروفة'),
      coalesce(new.amount::text, '0'),
      coalesce(currency_name, 'EGP')
    );
  else
    select exists (
      select 1
      from public.subscriptions s
      where s.organization_id = new.organization_id
        and s.status in ('active','trialing','pending_review')
        and coalesce(s.expires_at, now()) >= now()
    ) into is_renewal;

    if new.request_type in ('renewal','subscription_renewal') or is_renewal then
      notification_title := 'طلب تجديد اشتراك جديد';
      notification_body := format(
        'شركة %s أرسلت طلب تجديد %s بقيمة %s %s، ويحتاج مراجعة.',
        coalesce(org_name, 'غير معروفة'),
        coalesce(plan_name, 'الباقة'),
        coalesce(new.amount::text, '0'),
        coalesce(currency_name, 'EGP')
      );
    else
      notification_title := 'طلب اشتراك باقة جديد';
      notification_body := format(
        'شركة %s أرسلت طلب اشتراك %s بقيمة %s %s، ويحتاج مراجعة.',
        coalesce(org_name, 'غير معروفة'),
        coalesce(plan_name, 'الباقة'),
        coalesce(new.amount::text, '0'),
        coalesce(currency_name, 'EGP')
      );
    end if;
  end if;

  insert into public.notifications (
    organization_id, user_id, title, body, created_at, type,
    message, link, entity_type, entity_id, is_read
  )
  select
    null, u.id, notification_title, notification_body, now(),
    case when new.request_type = 'ryan_credits' then 'ryan_payment_request' else 'payment_request' end,
    notification_body, '/admin/payments', 'payment_request', new.id, false
  from public.users u
  where u.is_platform_admin = true
    and u.active = true;

  return new;
end;
$function$;

-- Requests created before this fix should no longer appear as manual-review items.
update public.payment_requests
set status = 'pending_payment'
where lower(coalesce(method, '')) = 'paymob'
  and status = 'pending_review';
