create table if not exists public.paymob_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_request_id uuid not null unique references public.payment_requests(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  amount numeric not null,
  currency text not null default 'EGP',
  billing_cycle text not null default 'monthly',
  integration_id bigint not null,
  merchant_reference text not null unique,
  intention_id text unique,
  order_id bigint unique,
  transaction_id bigint unique,
  status text not null default 'initiated',
  hmac_verified boolean not null default false,
  raw_callback jsonb,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paymob_transactions_org_idx on public.paymob_transactions(organization_id);
create index if not exists paymob_transactions_order_idx on public.paymob_transactions(order_id);

alter table public.paymob_transactions enable row level security;

drop policy if exists paymob_transactions_tenant_select on public.paymob_transactions;
create policy paymob_transactions_tenant_select
on public.paymob_transactions
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
);

revoke all on public.paymob_transactions from anon, authenticated;
grant select on public.paymob_transactions to authenticated;

create or replace function public.activate_paymob_payment(
  p_paymob_transaction_id bigint,
  p_order_id bigint,
  p_amount_cents integer,
  p_callback jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_tx public.paymob_transactions%rowtype;
  v_request public.payment_requests%rowtype;
  v_plan public.plans%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_duration integer;
  v_cycle text;
  v_expected numeric;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_renewal_date date;
begin
  select * into v_tx
  from public.paymob_transactions
  where transaction_id = p_paymob_transaction_id
     or order_id = p_order_id
  for update;

  if not found then
    raise exception 'عملية Paymob غير مسجلة';
  end if;

  if v_tx.amount * 100 <> p_amount_cents then
    raise exception 'قيمة عملية Paymob لا تطابق الطلب';
  end if;

  update public.paymob_transactions
  set transaction_id = p_paymob_transaction_id,
      order_id = coalesce(order_id, p_order_id),
      status = 'paid',
      hmac_verified = true,
      raw_callback = p_callback,
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_tx.id
  returning * into v_tx;

  if v_tx.payment_request_id is null then
    raise exception 'طلب الدفع غير مرتبط بعملية Paymob';
  end if;

  select * into v_request
  from public.payment_requests
  where id = v_tx.payment_request_id
  for update;

  if not found then
    raise exception 'طلب الدفع غير موجود';
  end if;

  if v_request.status = 'approved' then
    return jsonb_build_object('success', true, 'already_activated', true, 'payment_request_id', v_request.id);
  end if;

  if v_request.request_type <> 'subscription' then
    raise exception 'عملية Paymob مرتبطة بطلب غير صالح';
  end if;

  select * into v_plan from public.plans
  where id = v_request.plan_id and status = 'active';

  if not found then
    raise exception 'الخطة غير متاحة';
  end if;

  v_cycle := coalesce(v_request.billing_cycle, 'monthly');
  v_expected := case when v_cycle = 'yearly' then v_plan.yearly_price else v_plan.price end;

  if v_expected is null or v_request.amount <> v_expected then
    raise exception 'قيمة طلب الدفع لا تطابق سعر الخطة';
  end if;

  v_duration := case when v_cycle = 'yearly' then 365 when v_cycle = 'monthly' then 30 else 0 end;
  if v_duration = 0 then
    raise exception 'دورة الفوترة غير مدعومة';
  end if;

  select * into v_subscription
  from public.subscriptions
  where organization_id = v_request.organization_id
  order by case
    when status in ('active','trialing') then 1
    when status = 'pending_review' then 2
    when status = 'pending_payment' then 3
    else 4 end,
    renewal_date desc nulls last
  limit 1
  for update;

  if v_subscription.id is null then
    insert into public.subscriptions(
      organization_id, plan_id, status, billing_cycle, started_at, expires_at,
      renewal_date, features_snapshot, limits_snapshot
    )
    values(
      v_request.organization_id, v_request.plan_id, 'active', v_cycle, current_date,
      current_date + v_duration, current_date + v_duration,
      coalesce(v_plan.features,'{}'::jsonb), coalesce(v_plan.limits,'{}'::jsonb)
    )
    returning * into v_subscription;
  else
    v_renewal_date := case
      when v_subscription.status in ('active','trialing')
       and v_subscription.expires_at is not null
       and v_subscription.expires_at >= current_date
      then v_subscription.expires_at + v_duration
      else current_date + v_duration
    end;

    update public.subscriptions
    set plan_id = v_request.plan_id,
        status = 'active',
        billing_cycle = v_cycle,
        started_at = case
          when v_subscription.status in ('active','trialing')
           and v_subscription.started_at is not null
           and v_subscription.expires_at >= current_date
          then v_subscription.started_at else current_date end,
        expires_at = v_renewal_date,
        renewal_date = v_renewal_date,
        features_snapshot = coalesce(v_plan.features,'{}'::jsonb),
        limits_snapshot = coalesce(v_plan.limits,'{}'::jsonb)
    where id = v_subscription.id
    returning * into v_subscription;
  end if;

  insert into public.invoices(organization_id, subscription_id, amount, status, due_date)
  values(v_request.organization_id, v_subscription.id, v_request.amount, 'مدفوعة', current_date)
  returning id into v_invoice_id;

  insert into public.payments(invoice_id, amount, method, paid_at)
  values(v_invoice_id, v_request.amount, 'paymob', now())
  returning id into v_payment_id;

  update public.payment_requests
  set status='approved',
      reviewed_by=null,
      reviewed_at=now(),
      rejection_reason=null,
      method='paymob',
      reference=coalesce(reference, p_paymob_transaction_id::text)
  where id=v_request.id;

  insert into public.audit_logs(
    organization_id, actor_id, action, entity, entity_id, details
  )
  values(
    v_request.organization_id, null, 'paymob_payment_approved',
    'payment_request', v_request.id,
    jsonb_build_object(
      'plan_id', v_request.plan_id,
      'amount', v_request.amount,
      'payment_method', 'paymob',
      'billing_cycle', v_cycle,
      'invoice_id', v_invoice_id,
      'payment_id', v_payment_id,
      'paymob_transaction_id', p_paymob_transaction_id,
      'paymob_order_id', p_order_id,
      'expires_at', v_subscription.expires_at
    )
  );

  insert into public.notifications(user_id, title, body, message, type, entity_type, entity_id)
  select u.id,
         'تم تفعيل اشتراكك',
         'تم استلام الدفع عبر Paymob وتفعيل خطة '||v_plan.name||' حتى '||to_char(v_subscription.expires_at,'YYYY-MM-DD'),
         'تم استلام الدفع عبر Paymob وتفعيل خطة '||v_plan.name||' حتى '||to_char(v_subscription.expires_at,'YYYY-MM-DD'),
         'billing',
         'subscription',
         v_subscription.id
  from public.users u
  where u.organization_id=v_request.organization_id
    and u.active=true;

  return jsonb_build_object(
    'success', true,
    'already_activated', false,
    'payment_request_id', v_request.id,
    'invoice_id', v_invoice_id,
    'payment_id', v_payment_id,
    'plan_id', v_request.plan_id,
    'expires_at', v_subscription.expires_at
  );
end;
$function$;

revoke all on function public.activate_paymob_payment(bigint,bigint,integer,jsonb) from public, anon, authenticated;
grant execute on function public.activate_paymob_payment(bigint,bigint,integer,jsonb) to service_role;
