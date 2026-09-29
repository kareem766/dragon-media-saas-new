create or replace function public.create_ryan_credit_purchase(p_messages integer,p_amount numeric,p_method text,p_reference text,p_payment_date date,p_note text default null,p_payment_method_snapshot jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_purchase uuid; v_request uuid;
begin
 if v_user is null then raise exception 'غير مصرح'; end if;
 select organization_id into v_org from public.users where id=v_user and active=true;
 if v_org is null then raise exception 'لا يوجد حساب شركة فعال'; end if;
 if public.org_is_suspended(v_org) then raise exception 'المؤسسة موقوفة حالياً'; end if;
 if not public.subscription_has_feature(v_org,'ryan') then raise exception 'Ryan غير متاح في الباقة الحالية'; end if;
 if p_messages is null or p_messages<=0 then raise exception 'عدد الرسائل غير صالح'; end if;
 if p_amount is null or p_amount<0 then raise exception 'قيمة الدفع غير صالحة'; end if;
 if coalesce(trim(p_method),'')='' or coalesce(trim(p_reference),'')='' then raise exception 'بيانات الدفع غير مكتملة'; end if;
 insert into public.ryan_credit_purchases(organization_id,messages,amount) values(v_org,p_messages,p_amount) returning id into v_purchase;
 insert into public.payment_requests(organization_id,plan_id,amount,method,reference,payment_date,note,status,item_snapshot,payment_method_snapshot,request_type,ryan_credit_purchase_id)
 values(v_org,null,p_amount,p_method,p_reference,coalesce(p_payment_date,current_date),p_note,'pending_review',jsonb_build_object('type','ryan_credits','messages',p_messages,'purchase_id',v_purchase),coalesce(p_payment_method_snapshot,'{}'::jsonb),'ryan_credits',v_purchase) returning id into v_request;
 update public.ryan_credit_purchases set payment_request_id=v_request where id=v_purchase;
 return jsonb_build_object('success',true,'purchase_id',v_purchase,'payment_request_id',v_request);
end; $$;

create or replace function public.create_ryan_credit_purchase(p_package_id uuid,p_method text,p_reference text,p_payment_date date,p_note text default null,p_payment_method_snapshot jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_package public.ryan_message_packages%rowtype; v_purchase uuid; v_request uuid;
begin
 if v_user is null then raise exception 'غير مصرح'; end if;
 select organization_id into v_org from public.users where id=v_user and active=true;
 if v_org is null then raise exception 'لا يوجد حساب شركة فعال'; end if;
 if public.org_is_suspended(v_org) then raise exception 'المؤسسة موقوفة حالياً'; end if;
 if not public.subscription_has_feature(v_org,'ryan') then raise exception 'Ryan غير متاح في الباقة الحالية'; end if;
 select * into v_package from public.ryan_message_packages where id=p_package_id and status='active';
 if not found then raise exception 'باقة Ryan غير متاحة'; end if;
 if coalesce(trim(p_method),'')='' or coalesce(trim(p_reference),'')='' then raise exception 'بيانات الدفع غير مكتملة'; end if;
 insert into public.ryan_credit_purchases(organization_id,messages,amount) values(v_org,v_package.messages,v_package.price) returning id into v_purchase;
 insert into public.payment_requests(organization_id,plan_id,amount,method,reference,payment_date,note,status,item_snapshot,payment_method_snapshot,request_type,ryan_credit_purchase_id)
 values(v_org,null,v_package.price,p_method,p_reference,coalesce(p_payment_date,current_date),p_note,'pending_review',jsonb_build_object('type','ryan_credits','package_id',v_package.id,'package_name',v_package.name,'messages',v_package.messages,'purchase_id',v_purchase),coalesce(p_payment_method_snapshot,'{}'::jsonb),'ryan_credits',v_purchase) returning id into v_request;
 update public.ryan_credit_purchases set payment_request_id=v_request where id=v_purchase;
 return jsonb_build_object('success',true,'purchase_id',v_purchase,'payment_request_id',v_request,'package_id',v_package.id,'messages',v_package.messages,'amount',v_package.price);
end; $$;

create or replace function public.redeem_invite_code(p_code text,p_full_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_invite public.invite_codes%rowtype; v_email text; v_limit int; v_count int; v_existing_org uuid; v_terms_accepted_at timestamptz; v_terms_version text; v_privacy_at timestamptz; v_privacy_version text; v_suspended boolean;
begin
 if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 if p_code is null or length(trim(p_code))<6 or length(trim(p_code))>32 then raise exception 'كود الدعوة غير صالح'; end if;
 if p_full_name is null or length(trim(p_full_name))<2 then raise exception 'الاسم مطلوب'; end if;
 if length(trim(p_full_name))>150 then raise exception 'الاسم طويل جداً'; end if;
 select organization_id into v_existing_org from public.users where id=auth.uid();
 if v_existing_org is not null then raise exception 'حسابك مرتبط بمؤسسة بالفعل'; end if;
 select (raw_user_meta_data->>'terms_accepted_at')::timestamptz,raw_user_meta_data->>'terms_version',(raw_user_meta_data->>'privacy_policy_accepted_at')::timestamptz,raw_user_meta_data->>'privacy_policy_version'
 into v_terms_accepted_at,v_terms_version,v_privacy_at,v_privacy_version from auth.users where id=auth.uid();
 if v_terms_accepted_at is null or v_privacy_at is null then raise exception 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية'; end if;
 select ic.* into v_invite from public.invite_codes ic where code=upper(trim(p_code)) and used_by is null for update;
 if not found then raise exception 'كود الدعوة غير صالح أو مستخدم من قبل'; end if;
 if v_invite.expires_at is null or v_invite.expires_at<=now() then raise exception 'انتهت صلاحية كود الدعوة. اطلب من مسؤول الشركة إنشاء دعوة جديدة'; end if;
 if v_invite.role not in ('admin','sales','support','employee') then raise exception 'الدور الموجود في كود الدعوة غير مسموح به'; end if;
 select coalesce(o.suspended,false) into v_suspended from public.organizations o where o.id=v_invite.organization_id;
 if v_suspended then raise exception 'المؤسسة موقوفة حالياً'; end if;
 select (p.limits->>'users')::int into v_limit from public.subscriptions s join public.plans p on p.id=s.plan_id where s.organization_id=v_invite.organization_id and s.status in ('active','trialing') limit 1;
 if v_limit is null then raise exception 'لا يوجد اشتراك نشط يسمح بقبول الدعوة'; end if;
 select count(*) into v_count from public.users where organization_id=v_invite.organization_id;
 if v_count>=v_limit then raise exception 'تم الوصول للحد الأقصى لعدد المستخدمين في باقة هذه المؤسسة (%)',v_limit; end if;
 select email into v_email from auth.users where id=auth.uid();
 if v_email is null then raise exception 'تعذر الحصول على البريد الإلكتروني للحساب'; end if;
 insert into public.users(id,organization_id,full_name,email,role,terms_accepted_at,terms_version,privacy_policy_accepted_at,privacy_policy_version)
 values(auth.uid(),v_invite.organization_id,trim(p_full_name),v_email,v_invite.role,v_terms_accepted_at,v_terms_version,v_privacy_at,v_privacy_version);
 update public.invite_codes set used_by=auth.uid(),used_at=now() where id=v_invite.id and used_by is null;
 if not found then raise exception 'تعذر تأكيد استخدام كود الدعوة'; end if;
 return v_invite.organization_id;
end; $$;