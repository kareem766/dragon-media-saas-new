create table if not exists public.ai_content_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  prompt text not null,
  content_type text not null default 'custom',
  tone text not null default 'professional',
  image_style text not null default 'modern',
  hook text not null default '',
  content text not null default '',
  cta text not null default '',
  image_url text,
  image_path text,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','publishing','published','failed')),
  target_platforms text[] not null default '{}',
  scheduled_at timestamptz,
  publish_results jsonb not null default '{}'::jsonb,
  generation_model text,
  image_model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_content_posts_org_updated_idx on public.ai_content_posts (organization_id, updated_at desc);
create index if not exists ai_content_posts_org_status_idx on public.ai_content_posts (organization_id, status);

alter table public.ai_content_posts enable row level security;

drop policy if exists ai_content_posts_select_own_org on public.ai_content_posts;
create policy ai_content_posts_select_own_org on public.ai_content_posts for select to authenticated
using (organization_id = (select u.organization_id from public.users u where u.id = (select auth.uid()) and u.active = true));

drop policy if exists ai_content_posts_insert_own_org on public.ai_content_posts;
create policy ai_content_posts_insert_own_org on public.ai_content_posts for insert to authenticated
with check (
  organization_id = (select u.organization_id from public.users u where u.id = (select auth.uid()) and u.active = true)
  and created_by = (select auth.uid())
);

drop policy if exists ai_content_posts_update_own_org on public.ai_content_posts;
create policy ai_content_posts_update_own_org on public.ai_content_posts for update to authenticated
using (organization_id = (select u.organization_id from public.users u where u.id = (select auth.uid()) and u.active = true))
with check (organization_id = (select u.organization_id from public.users u where u.id = (select auth.uid()) and u.active = true));

drop policy if exists ai_content_posts_delete_own_org on public.ai_content_posts;
create policy ai_content_posts_delete_own_org on public.ai_content_posts for delete to authenticated
using (organization_id = (select u.organization_id from public.users u where u.id = (select auth.uid()) and u.active = true));

insert into public.role_permissions (role, resource, can_view, can_edit, can_delete)
values
  ('super_admin','ai_content',true,true,true),
  ('admin','ai_content',true,true,true),
  ('sales','ai_content',true,true,false),
  ('employee','ai_content',true,true,false),
  ('support','ai_content',false,false,false)
on conflict (role, resource) do update set
  can_view = excluded.can_view,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete;

insert into storage.buckets (id, name, public)
values ('ai-content','ai-content',true)
on conflict (id) do update set public = excluded.public;

drop policy if exists ai_content_public_read on storage.objects;
create policy ai_content_public_read on storage.objects for select to public using (bucket_id = 'ai-content');

drop policy if exists ai_content_auth_upload on storage.objects;
create policy ai_content_auth_upload on storage.objects for insert to authenticated with check (bucket_id = 'ai-content');

drop policy if exists ai_content_auth_update on storage.objects;
create policy ai_content_auth_update on storage.objects for update to authenticated using (bucket_id = 'ai-content') with check (bucket_id = 'ai-content');

drop policy if exists ai_content_auth_delete on storage.objects;
create policy ai_content_auth_delete on storage.objects for delete to authenticated using (bucket_id = 'ai-content');
