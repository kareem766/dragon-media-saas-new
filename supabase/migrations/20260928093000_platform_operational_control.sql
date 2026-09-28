alter table public.platform_settings
  add column if not exists platform_enabled boolean not null default true,
  add column if not exists maintenance_message text not null default 'المنصة متوقفة مؤقتًا للصيانة. سنعود للعمل قريبًا.';