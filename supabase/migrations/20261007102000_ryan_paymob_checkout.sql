alter table public.paymob_transactions alter column plan_id drop not null;

create or replace function public.activate_ryan_paymob_payment(
  p_paymob_transaction_id bigint,
  p_order_id bigint,
  p_amount_cents integer,
  p_integration_id bigint,
  p_callback jsonb
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_tx public.paymob_transactions%rowtype;
  v_request public.payment_requests%rowtype;
  v_purchase public.ryan_credit_purchases%rowtype;
  v_expires_at timestamptz;
begin
  if p_paymob_transaction_id is null or p_order_id is null or p_amount_cents is null then
    raise exception 'بيانات عملية Paymob غير مكتملة';
  end if;

  select *
  into v_tx
  from public.paymob_transactions
  where transaction_id = p_paymob_transaction_id
     or order_id = p_order_id
  order by case when transaction_id = p_paymob_transaction_id then 0 else 1 end
  limit 1
  for update;

  if not found then
    raise exception 'عملية Paymob غير مسجلة';
  end if;

  if v_tx.order_id is not null and v_tx.order_id <> p_order_id then
    raise exception 'رقم طلب Paymob لا يطابق العملية';
  end if;

  if v_tx.integration_id is not null and v_tx.integration_id <> p_integration_id then
    raise exception 'Integration ID لا يطابق العملية';
  end if;

  if v_tx.amount * 100 <> p_amount_cents then
    raise exception 'قيمة عملية Paymob لا تطابق الطلب';
  end if;

  select *
  into v_request
  from public.payment_requests
  where id = v_tx.payment_request_id
  for update;

  if not found then
    raise exception 'طلب الدفع غير موجود';
  end if;

  if v_request.request_type <> 'ryan_credits' or v_request.ryan_credit_purchase_id is null then
    raise exception 'عملية Paymob مرتبطة بطلب Ryan غير صالح';
  end if;

  select *
  into v_purchase
  from public.ryan_credit_purchases
  where id = v_request.ryan_credit_purchase_id
  for update;

  if not found then
    raise exception 'عملية شراء Ryan غير موجودة';
  end if;

  if v_request.amount <> v_purchase.amount then
    raise exception 'قيمة طلب Ryan لا تطابق عملية الشراء';
  end if;

  update public.paymob_transactions
  set transaction_id = p_paymob_transaction_id,
      order_id = coalesce(order_id, p_order_id),
      status = 'paid',
      hmac_verified = true,
      raw_callback = p_callback,
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_tx.id;

  if v_purchase.status = 'approved' and v_request.status = 'approved' then
    return jsonb_build_object(
      'success', true,
      'already_activated', true,
      'purchase_id', v_purchase.id,
      'messages', v_purchase.messages
    );
  end if;

  if v_purchase.status <> 'pending_review' or v_request.status <> 'pending_payment' then
    raise exception 'عملية شراء Ryan تمت معالجتها بالفعل أو في حالة غير صالحة';
  end if;

  v_expires_at := now() + interval '30 days';

  update public.ryan_credit_purchases
  set status='approved',
      purchased_at=now(),
      expires_at=v_expires_at,
      reviewed_by=null,
      reviewed_at=now(),
      rejection_reason=null
  where id=v_purchase.id;

  update public.payment_requests
  set status='approved',
      reviewed_by=null,
      reviewed_at=now(),
      rejection_reason=null,
      method='paymob',
      reference=coalesce(reference, p_paymob_transaction_id::text)
  where id=v_request.id;

  insert into public.notifications(
    organization_id,user_id,title,body,type,message,link,entity_type,entity_id,is_read
  )
  select
    v_request.organization_id,
    u.id,
    'تم شراء رصيد Ryan بنجاح',
    format('تم اعتماد شراء %s رسالة Ryan بقيمة %s %s وإضافتها لرصيد شركتك.',v_purchase.messages,v_purchase.amount,v_purchase.currency),
    'ryan_payment_approved',
    format('تم اعتماد شراء %s رسالة Ryan وإضافتها لرصيد شركتك.',v_purchase.messages),
    '/ryan',
    'ryan_credit_purchase',
    v_purchase.id,
    false
  from public.users u
  where u.organization_id=v_request.organization_id
    and u.active=true
    and u.is_platform_admin=false;

  insert into public.audit_logs(
    organization_id,actor_id,action,entity,entity_id,details
  )
  values(
    v_request.organization_id,
    null,
    'ryan_paymob_payment_approved',
    'ryan_credit_purchase',
    v_purchase.id,
    jsonb_build_object(
      'payment_request_id',v_request.id,
      'amount',v_purchase.amount,
      'messages',v_purchase.messages,
      'payment_method','paymob',
      'paymob_transaction_id',p_paymob_transaction_id,
      'paymob_order_id',p_order_id,
      'expires_at',v_expires_at
    )
  );

  return jsonb_build_object(
    'success',true,
    'already_activated',false,
    'purchase_id',v_purchase.id,
    'payment_request_id',v_request.id,
    'messages',v_purchase.messages,
    'expires_at',v_expires_at
  );
end;
$$;

revoke all on function public.activate_ryan_paymob_payment(bigint,bigint,integer,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.activate_ryan_paymob_payment(bigint,bigint,integer,bigint,jsonb) to service_role;