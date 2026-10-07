-- Step 3 — Strengthen employee invite codes
-- Preserve all existing authorization, organization, suspension, permission,
-- role allowlist, and 24-hour expiry behavior; only increase code entropy.
create or replace function public.generate_invite_code(p_role text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select organization_id into v_org_id from public.users where id = auth.uid() and active = true;
  if v_org_id is null then raise exception 'المستخدم غير مرتبط بأي مؤسسة أو الحساب غير نشط'; end if;
  if public.org_is_suspended(v_org_id) then raise exception 'المؤسسة موقوفة حالياً'; end if;
  if not public.has_permission('users', 'edit') then raise exception 'ليس لديك صلاحية لإدارة أعضاء الفريق'; end if;
  p_role := lower(trim(coalesce(p_role, '')));
  if p_role not in ('admin','sales','support','employee') then raise exception 'الدور المطلوب غير مسموح به عبر الدعوات'; end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    exit when not exists (select 1 from public.invite_codes where code = v_code);
  end loop;
  insert into public.invite_codes (organization_id, code, role, created_by, expires_at)
  values (v_org_id, v_code, p_role, auth.uid(), now() + interval '24 hours');
  return v_code;
end;
$function$;
