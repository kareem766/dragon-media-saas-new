-- Persist the support notification trigger in the repository.
create or replace function public.notify_platform_admin_new_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_name text;
  v_subject text;
begin
  select name into v_org_name from public.organizations where id = new.organization_id;
  v_subject := coalesce(nullif(trim(new.subject), ''), 'تذكرة دعم جديدة');

  insert into public.notifications (
    organization_id, user_id, type, title, body, message, link,
    entity_type, entity_id, is_read
  )
  select
    new.organization_id, u.id, 'support_ticket', 'تذكرة دعم جديدة',
    'وصلت تذكرة دعم جديدة من شركة ' || coalesce(v_org_name, 'غير معروفة') || ': ' || v_subject,
    'وصلت تذكرة دعم جديدة من شركة ' || coalesce(v_org_name, 'غير معروفة') || ': ' || v_subject,
    '/admin/tickets', 'support_ticket', new.id, false
  from public.users u
  where u.is_platform_admin = true and u.active = true;

  return new;
end;
$$;

drop trigger if exists trg_notify_platform_admin_new_support_ticket on public.support_tickets;
create trigger trg_notify_platform_admin_new_support_ticket
after insert on public.support_tickets
for each row execute function public.notify_platform_admin_new_support_ticket();
