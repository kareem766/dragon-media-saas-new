-- Employee invitation acceptance: an invited signup joins the existing organization
-- instead of creating a new organization.

create schema if not exists private;

create or replace function private.accept_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_code, '')));
  v_invite record;
  v_auth_user record;
  v_org record;
  v_existing_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if v_code = '' then
    raise exception 'كود الدعوة مطلوب';
  end if;

  select id, organization_id, role, used_by, used_at
  into v_invite
  from public.invite_codes
  where code = v_code
  for update;

  if not found then
    raise exception 'كود الدعوة غير صحيح';
  end if;

  if v_invite.used_by is not null or v_invite.used_at is not null then
    raise exception 'كود الدعوة تم استخدامه بالفعل';
  end if;

  if v_invite.organization_id is null then
    raise exception 'كود الدعوة غير مرتبط بشركة';
  end if;

  select id, email, email_confirmed_at,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'terms_accepted_at' as terms_accepted_at,
    raw_user_meta_data->>'terms_version' as terms_version,
    raw_user_meta_data->>'privacy_policy_accepted_at' as privacy_policy_accepted_at,
    raw_user_meta_data->>'privacy_policy_version' as privacy_policy_version
  into v_auth_user
  from auth.users
  where id = v_user_id;

  if v_auth_user.email_confirmed_at is null then
    raise exception 'يجب تأكيد البريد الإلكتروني قبل الانضمام للشركة';
  end if;

  if exists (select 1 from public.users where id = v_user_id) then
    select organization_id into v_existing_org_id
    from public.users where id = v_user_id;
    if v_existing_org_id = v_invite.organization_id then
      raise exception 'الحساب منضم بالفعل إلى هذه الشركة';
    end if;
    raise exception 'الحساب مرتبط بشركة أخرى بالفعل';
  end if;

  if v_auth_user.terms_accepted_at is null or v_auth_user.privacy_policy_accepted_at is null then
    raise exception 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية';
  end if;

  select id, name, slug, suspended
  into v_org
  from public.organizations
  where id = v_invite.organization_id;

  if not found then
    raise exception 'الشركة المرتبطة بكود الدعوة غير موجودة';
  end if;

  if coalesce(v_org.suspended, false) then
    raise exception 'الشركة موقوفة حالياً';
  end if;

  insert into public.users (
    id, organization_id, full_name, email, role, active,
    terms_accepted_at, terms_version,
    privacy_policy_accepted_at, privacy_policy_version
  )
  values (
    v_user_id,
    v_invite.organization_id,
    coalesce(nullif(trim(v_auth_user.full_name), ''), v_auth_user.email),
    v_auth_user.email,
    v_invite.role,
    true,
    v_auth_user.terms_accepted_at::timestamptz,
    v_auth_user.terms_version,
    v_auth_user.privacy_policy_accepted_at::timestamptz,
    v_auth_user.privacy_policy_version
  );

  update public.invite_codes
  set used_by = v_user_id, used_at = now()
  where id = v_invite.id;

  return jsonb_build_object(
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'organization_slug', v_org.slug,
    'role', v_invite.role
  );
end;
$$;

revoke execute on function private.accept_invite_code(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.accept_invite_code(text) to authenticated;
