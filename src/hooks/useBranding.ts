import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface BrandingSettings {
  id: string;
  platform_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  company_name: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  is_default: boolean;
}

const DEFAULT_LOGO = '/dragon-media-logo-default.svg';

let cachedBranding: BrandingSettings | null = null;
let listeners: Array<(b: BrandingSettings) => void> = [];

function applyToDocument(b: BrandingSettings) {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primary_color);
  root.style.setProperty('--brand-secondary', b.secondary_color);
  root.style.setProperty('--brand-accent', b.accent_color);

  document.title = b.platform_name || 'Dragon Media';

  if (b.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.favicon_url;
  }
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings | null>(cachedBranding);
  const [loading, setLoading] = useState(!cachedBranding);

  const refresh = useCallback(async () => {
    const sb = supabase;
    if (!sb) return;
    const { data, error } = await sb.from('branding_settings').select('*').limit(1).single();
    if (!error && data) {
      cachedBranding = data as BrandingSettings;
      applyToDocument(cachedBranding);
      listeners.forEach((l) => l(cachedBranding!));
      setBranding(cachedBranding);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!cachedBranding) {
      refresh();
    } else {
      applyToDocument(cachedBranding);
    }
    const listener = (b: BrandingSettings) => setBranding(b);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, [refresh]);

  const logoUrl = branding?.logo_url || DEFAULT_LOGO;
  const logoDarkUrl = branding?.logo_dark_url || branding?.logo_url || DEFAULT_LOGO;

  return { branding, loading, refresh, logoUrl, logoDarkUrl };
}
