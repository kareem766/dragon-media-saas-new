alter table public.subscriptions
  add column if not exists features_snapshot jsonb,
  add column if not exists limits_snapshot jsonb;

-- Active subscriptions receive a durable snapshot when they are approved/assigned.
-- The live plan remains the source for pricing; the snapshot is the source for purchased access.

create or replace function public.approve_payment_request(p_request_id uuid,p_reviewer_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_request public.payment_requests%rowtype; v_plan public.plans%rowtype; v_subscription public.subscriptions%rowtype;
v_duration integer; v_cycle text; v_expected numeric; v_invoice_id uuid; v_payment_id uuid; v_renewal_date date;
begin
if not exists(select 1 from public.users where id=auth.uid() and is_platform_admin=true and active=true) then raise exception 'غير مصرح لك باعتماد طلبات الدفع'; end if;
if p_reviewer_id is null or p_reviewer_id<>auth.uid() then raise exception 'المراجع غير صحيح'; end if;
select * into v_request from public.payment_requests where id=p_request_id for update;
if not found or v_request.status<>'pending_review' or v_request.request_type<>'subscription' then raise exception 'طلب الدفع ليس طلب اشتراك قيد المراجعة'; end if;
select * into v_plan from public.plans where id=v_request.plan_id and status='active';
if not found then raise exception 'الخطة غير متاحة'; end if;
v_cycle:=coalesce(v_request.billing_cycle,(v_request.item_snapshot->>'billing_cycle'),'monthly');
v_expected:=case when v_cycle='yearly' then v_plan.yearly_price else v_plan.price end;
if v_expected is null or v_request.amount<>v_expected then raise exception 'قيمة طلب الدفع لا تطابق سعر الخطة'; end if;
v_duration:=case when v_cycle='yearly' then 365 when v_cycle='monthly' then 30 else 0 end;
if v_duration=0 then raise exception 'دورة الفوترة غير مدعومة'; end if;
select * into v_subscription from public.subscriptions where organization_id=v_request.organization_id
order by case when status in('active','trialing') then 1 when status='pending_review' then 2 when status='pending_payment' then 3 else 4 end,renewal_date desc nulls last limit 1 for update;
if v_subscription.id is null then
insert into public.subscriptions(organization_id,plan_id,status,billing_cycle,started_at,expires_at,renewal_date,features_snapshot,limits_snapshot)
values(v_request.organization_id,v_request.plan_id,'active',v_cycle,current_date,current_date+v_duration,current_date+v_duration,coalesce(v_plan.features,'{}'::jsonb),coalesce(v_plan.limits,'{}'::jsonb))
returning * into v_subscription;
else
v_renewal_date:=case when v_subscription.status in('active','trialing') and v_subscription.expires_at is not null and v_subscription.expires_at>=current_date then v_subscription.expires_at+v_duration else current_date+v_duration end;
update public.subscriptions set plan_id=v_request.plan_id,status='active',billing_cycle=v_cycle,
started_at=case when v_subscription.status in('active','trialing') and v_subscription.started_at is not null and v_subscription.expires_at>=current_date then v_subscription.started_at else current_date end,
expires_at=v_renewal_date,renewal_date=v_renewal_date,features_snapshot=coalesce(v_plan.features,'{}'::jsonb),limits_snapshot=coalesce(v_plan.limits,'{}'::jsonb)
where id=v_subscription.id returning * into v_subscription;
end if;
insert into public.invoices(organization_id,subscription_id,amount,status,due_date) values(v_request.organization_id,v_subscription.id,v_request.amount,'مدفوعة',current_date) returning id into v_invoice_id;
insert into public.payments(invoice_id,amount,method,paid_at) values(v_invoice_id,v_request.amount,v_request.method,now()) returning id into v_payment_id;
update public.payment_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null where id=v_request.id;
insert into public.audit_logs(organization_id,actor_id,action,entity,entity_id,details) values(v_request.organization_id,auth.uid(),'approve_payment_request','payment_request',v_request.id,jsonb_build_object('plan_id',v_request.plan_id,'amount',v_request.amount,'payment_method',v_request.method,'billing_cycle',v_cycle,'invoice_id',v_invoice_id,'payment_id',v_payment_id,'expires_at',v_subscription.expires_at));
insert into public.notifications(user_id,title,message,type,entity_type,entity_id)
select u.id,'تم تفعيل اشتراكك','تم اعتماد طلب الدفع وتفعيل اشتراك خطة '||v_plan.name||' حتى '||to_char(v_subscription.expires_at,'YYYY-MM-DD'),'billing','subscription',v_subscription.id
from public.users u where u.organization_id=v_request.organization_id;
return jsonb_build_object('success',true,'request_id',v_request.id,'invoice_id',v_invoice_id,'payment_id',v_payment_id,'plan_id',v_request.plan_id,'expires_at',v_subscription.expires_at,'billing_cycle',v_cycle);
end;
$function$;