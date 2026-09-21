alter table public.platform_settings
  add column if not exists integrations_enabled_before_subscription boolean not null default false;

alter table public.platform_settings
  add column if not exists whatsapp_settings_enabled_before_subscription boolean not null default false;
