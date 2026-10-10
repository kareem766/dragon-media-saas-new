-- Dragon Media: private platform-admin notes for each organization.
-- Apply this migration in the Supabase SQL Editor before using the Company File UI.
create table if not exists public.organization_admin_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 5000),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_admin_notes_org_created_idx
  on public.organization_admin_notes (organization_id, created_at desc);

alter table public.organization_admin_notes enable row level security;

-- No direct client access. The authenticated platform-admin API uses the
-- server-only service role after checking is_platform_admin.
revoke all on table public.organization_admin_notes from anon, authenticated;
grant all on table public.organization_admin_notes to service_role;
