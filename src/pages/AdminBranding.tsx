import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useBranding } from '../hooks/useBranding';
import { useAuth } from '../lib/AuthContext';

type LogoSlot = 'logo_url' | 'logo_dark_url' | 'favicon_url';

export default function AdminBranding() {
  const { branding, refresh } = useBranding();
  const { user } = useAuth();
  const [form, setForm] = useState(branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<LogoSlot | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputs = {
    logo_url: useRef<HTMLInputElement>(null),
    logo_dark_url: useRef<HTMLInputElement>(null),
    favicon_url: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (branding) setForm(branding);
  }, [branding]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!form) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink-900/20 border-t-ink-900 rounded-full animate-spin" />
      </div>
    );
  }

  async function uploadFile(slot: LogoSlot, file: File) {
    const sb = supabase;
    if (!sb) return;
    setUploading(slot);
    try {
      const ext = file.name.split('.').pop();
      const path = `${slot}-${Date.now()}.${ext}`;
      const { error: uploadError } = await sb.storage.from('branding').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: pub } = sb.storage.from('branding').getPublicUrl(path);
      setForm((f) => (f ? { ...f, [slot]: pub.publicUrl } : f));
      setToast('تم رفع الملف — لا تنسَ الضغط على حفظ التعديلات');
    } catch (err) {
      console.error(err);
      setToast('حدث خطأ أثناء الرفع');
    } finally {
      setUploading(null);
    }
  }

  function removeLogo(slot: LogoSlot) {
    setForm((f) => (f ? { ...f, [slot]: null } : f));
  }

  async function save() {
    const sb = supabase;
    if (!sb || !form) return;
    setSaving(true);
    try {
      const { error } = await sb
        .from('branding_settings')
        .update({
          platform_name: form.platform_name,
          logo_url: form.logo_url,
          logo_dark_url: form.logo_dark_url,
          favicon_url: form.favicon_url,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          accent_color: form.accent_color,
          company_name: form.company_name,
          description: form.description,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          whatsapp_number: form.whatsapp_number,
          website_url: form.website_url,
          social_links: form.social_links,
          is_default: !form.logo_url,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.id);
      if (error) throw error;
      await refresh();
      setToast('تم حفظ التعديلات بنجاح');
    } catch (err) {
      console.error(err);
      setToast('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  function restoreDefault() {
    setForm((f) =>
      f
        ? {
            ...f,
            logo_url: null,
            logo_dark_url: null,
            favicon_url: null,
            primary_color: '#4F46E5',
            secondary_color: '#7C3AED',
            accent_color: '#F59E0B',
          }
        : f
    );
    setConfirmReset(false);
  }

  const LogoUploader = ({
    slot,
    label,
    currentUrl,
  }: {
    slot: LogoSlot;
    label: string;
    currentUrl: string | null;
  }) => (
    <div className="border border-sand-200 rounded-xl p-4 space-y-3 bg-white">
      <h4 className="font-semibold text-ink-950">{label}</h4>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-lg bg-sand-50 border flex items-center justify-center overflow-hidden">
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-xs text-ink-900/40">لا يوجد</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputs[slot]}
            type="file"
            accept="image/png,image/svg+xml,image/x-icon,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(slot, file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputs[slot].current?.click()}
            disabled={uploading === slot}
            className="px-4 py-2 bg-ink-950 text-sand-50 rounded-lg text-sm disabled:opacity-50"
          >
            {uploading === slot ? 'جارٍ الرفع...' : currentUrl ? 'استبدال' : 'رفع'}
          </button>
          {currentUrl && (
            <button
              type="button"
              onClick={() => removeLogo(slot)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm"
            >
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-sand-50 p-6 space-y-8 relative max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-ink-950 text-sand-50 text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink-950">هوية المنصة</h1>
        <p className="text-ink-900/50 text-sm mt-1">
          إدارة اللوجو والألوان ومعلومات المنصة — يظهر التغيير تلقائيًا في كل مكان بعد الحفظ
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-950">إدارة لوجو المنصة</h2>
        <LogoUploader slot="logo_url" label="اللوجو (الوضع الفاتح)" currentUrl={form.logo_url} />
        <LogoUploader slot="logo_dark_url" label="اللوجو (الوضع الداكن)" currentUrl={form.logo_dark_url} />
        <LogoUploader slot="favicon_url" label="Favicon" currentUrl={form.favicon_url} />
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="text-sm text-ink-900/50 underline"
        >
          استعادة اللوجو والألوان الافتراضية لـ Dragon Media
        </button>
        {confirmReset && (
          <div className="border border-gold-500/40 bg-gold-500/10 rounded-lg p-3 text-sm flex items-center justify-between flex-wrap gap-2">
            <span>هل أنت متأكد أنك تريد استعادة الإعدادات الافتراضية؟</span>
            <div className="flex gap-2">
              <button onClick={restoreDefault} className="px-3 py-1 bg-ink-950 text-sand-50 rounded">
                تأكيد
              </button>
              <button onClick={() => setConfirmReset(false)} className="px-3 py-1 border rounded">
                إلغاء
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-950">الألوان</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['primary_color', 'secondary_color', 'accent_color'] as const).map((key) => (
            <div key={key}>
              <label className="text-xs text-ink-900/50 block mb-1">
                {key === 'primary_color' ? 'اللون الأساسي' : key === 'secondary_color' ? 'اللون الثانوي' : 'Accent'}
              </label>
              <input
                type="color"
                value={form[key]}
                onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f))}
                className="w-full h-10 rounded border"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-950">معلومات المنصة</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="اسم المنصة" value={form.platform_name} onChange={(v) => setForm((f) => f && { ...f, platform_name: v })} />
          <Field label="اسم الشركة" value={form.company_name || ''} onChange={(v) => setForm((f) => f && { ...f, company_name: v })} />
          <Field label="البريد الإلكتروني" value={form.contact_email || ''} onChange={(v) => setForm((f) => f && { ...f, contact_email: v })} />
          <Field label="رقم الهاتف" value={form.contact_phone || ''} onChange={(v) => setForm((f) => f && { ...f, contact_phone: v })} />
          <Field label="WhatsApp" value={form.whatsapp_number || ''} onChange={(v) => setForm((f) => f && { ...f, whatsapp_number: v })} />
          <Field label="Website" value={form.website_url || ''} onChange={(v) => setForm((f) => f && { ...f, website_url: v })} />
        </div>
        <div>
          <label className="text-xs text-ink-900/50 block mb-1">وصف المنصة</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })}
            className="w-full border rounded-lg p-2 text-sm"
            rows={3}
          />
        </div>
      </section>

      <div className="sticky bottom-0 bg-sand-50 border-t border-sand-200 pt-4 flex justify-end gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-ink-950 text-sand-50 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-ink-900/50 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg p-2 text-sm"
      />
    </div>
  );
}
