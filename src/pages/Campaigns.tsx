import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Campaign = {
  id: string;
  name: string;
  channel: string;
  audience: string | null;
  audience_filter: {
    status?: string | null;
    tag?: string | null;
    marketing_opt_in?: boolean;
  } | null;
  message_body: string | null;
  status: string | null;
  scheduled_at: string | null;
  created_at: string;
  total_recipients: number;
  queued_count: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  skipped_count: number;
  audience_preview_count?: number;
  error_message?: string | null;
};

type AudiencePreview = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  tags: string[] | null;
  marketing_opt_in: boolean;
};

const STATUS_OPTIONS = [
  'نشط',
  'جديد',
  'مهتم',
  'عميل',
  'غير نشط',
];

const CHANNELS = [
  {
    value: 'whatsapp',
    label: 'WhatsApp',
  },
  {
    value: 'messenger',
    label: 'Messenger',
  },
  {
    value: 'instagram',
    label: 'Instagram',
  },
  {
    value: 'email',
    label: 'Email',
  },
];

function statusLabel(status?: string | null) {
  if (!status) return 'غير محدد';

  const labels: Record<string, string> = {
    مسودة: 'مسودة',
    مجدولة: 'مجدولة',
    'جارٍ التحضير': 'جارٍ التحضير',
    جاهزة: 'جاهزة',
    إرسال: 'جاري الإرسال',
    'جاري الإرسال': 'جاري الإرسال',
    مكتملة: 'مكتملة',
    ملغاة: 'ملغاة',
    فشل: 'فشل',
  };

  return labels[status] || status;
}

function statusClass(status?: string | null) {
  switch (status) {
    case 'مكتملة':
      return 'bg-emerald-100 text-emerald-700';

    case 'جاهزة':
      return 'bg-blue-100 text-blue-700';

    case 'جارٍ التحضير':
      return 'bg-amber-100 text-amber-700';

    case 'ملغاة':
      return 'bg-slate-100 text-slate-600';

    case 'فشل':
      return 'bg-red-100 text-red-700';

    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function Campaigns() {
  const { organization } = useOrganization();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<
    AudiencePreview[]
  >([]);
  const [audienceCount, setAudienceCount] = useState(0);

  const [runningId, setRunningId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState({
    name: '',
    channel: 'whatsapp',
    message_body: '',
    status: '',
    tag: '',
    scheduled_at: '',
  });

  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = async () => {
    if (!organization?.id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      setError(error.message);
    } else {
      setCampaigns((data ?? []) as Campaign[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, [organization?.id]);

  const stats = useMemo(() => {
    return {
      total: campaigns.length,
      scheduled: campaigns.filter(
        (campaign) =>
          campaign.status === 'مجدولة' ||
          campaign.status === 'جاهزة',
      ).length,
      completed: campaigns.filter(
        (campaign) => campaign.status === 'مكتملة',
      ).length,
      failed: campaigns.filter(
        (campaign) => campaign.status === 'فشل',
      ).length,
    };
  }, [campaigns]);

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('انتهت جلسة تسجيل الدخول');
    }

    return session.access_token;
  };

  const callCampaignApi = async (
    action: string,
    campaignId: string,
  ) => {
    const token = await getAccessToken();

    const response = await fetch('/api/campaign-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        campaignId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error || 'حدث خطأ أثناء تنفيذ العملية',
      );
    }

    return result;
  };

  const createCampaign = async () => {
    setError(null);

    if (!organization?.id) {
      setError('لم يتم العثور على الشركة');
      return;
    }

    if (!form.name.trim()) {
      setError('اكتب اسم الحملة');
      return;
    }

    if (!form.message_body.trim()) {
      setError('اكتب محتوى الرسالة');
      return;
    }

    const audienceFilter = {
      status: form.status || null,
      tag: form.tag.trim() || null,
      marketing_opt_in: true,
    };

    const { data: userData } =
      await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from('campaigns')
      .insert({
        organization_id: organization.id,
        name: form.name.trim(),
        channel: form.channel,
        message_body: form.message_body.trim(),
        audience_filter: audienceFilter,
        audience: form.tag
          ? `Tag: ${form.tag}`
          : form.status
            ? `Status: ${form.status}`
            : 'كل العملاء المؤهلين',
        status: form.scheduled_at
          ? 'مجدولة'
          : 'مسودة',
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
        created_by: userData.user?.id ?? null,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm({
      name: '',
      channel: 'whatsapp',
      message_body: '',
      status: '',
      tag: '',
      scheduled_at: '',
    });

    setDialogOpen(false);

    await loadCampaigns();
  };

  const previewAudience = async () => {
    setError(null);

    if (!organization?.id) return;

    setPreviewLoading(true);
    setPreviewOpen(true);

    try {
      const token = await getAccessToken();

      const response = await fetch('/api/campaign-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'preview',
          campaignId:
            '__preview__',
        }),
      });

      /**
       * Preview is generated directly from customers here.
       * The campaign API intentionally requires a real campaign
       * for execution actions.
       */
      const filter = {
        status: form.status || null,
        tag: form.tag.trim() || null,
        marketing_opt_in: true,
      };

      let query = supabase
        .from('customers')
        .select(
          'id, name, company, phone, email, status, tags, marketing_opt_in',
        )
        .eq('organization_id', organization.id)
        .eq('marketing_opt_in', true)
        .limit(100);

      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      const { data, error: previewError } =
        await query;

      if (previewError) throw previewError;

      let customers =
        (data ?? []) as AudiencePreview[];

      if (filter.tag) {
        customers = customers.filter((customer) =>
          Array.isArray(customer.tags)
            ? customer.tags.some(
                (tag) =>
                  tag.toLowerCase() ===
                  filter.tag!.toLowerCase(),
              )
            : false,
        );
      }

      setAudiencePreview(customers);
      setAudienceCount(customers.length);
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر معاينة الجمهور',
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const prepareCampaign = async (
    campaign: Campaign,
  ) => {
    try {
      setError(null);
      setRunningId(campaign.id);

      await callCampaignApi(
        'prepare',
        campaign.id,
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(err?.message || 'تعذر تجهيز الحملة');
    } finally {
      setRunningId(null);
    }
  };

  const cancelCampaign = async (
    campaign: Campaign,
  ) => {
    try {
      setError(null);
      setRunningId(campaign.id);

      await callCampaignApi(
        'cancel',
        campaign.id,
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(err?.message || 'تعذر إلغاء الحملة');
    } finally {
      setRunningId(null);
    }
  };

  const retryCampaign = async (
    campaign: Campaign,
  ) => {
    try {
      setError(null);
      setRunningId(campaign.id);

      await callCampaignApi(
        'retry_failed',
        campaign.id,
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر إعادة المحاولة',
      );
    } finally {
      setRunningId(null);
    }
  };

  const refreshCampaign = async (
    campaign: Campaign,
  ) => {
    try {
      setRunningId(campaign.id);

      await callCampaignApi(
        'refresh',
        campaign.id,
      );

      await loadCampaigns();
    } catch (err: any) {
      setError(
        err?.message ||
          'تعذر تحديث الإحصائيات',
      );
    } finally {
      setRunningId(null);
    }
  };

  if (!organization?.id) {
    return (
      <div className="p-6" dir="rtl">
        <Card>
          <CardContent className="py-10 text-center">
            لم يتم العثور على بيانات الشركة.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 p-4 md:p-6"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-7 w-7" />
            <h1 className="text-2xl font-bold">
              الحملات التسويقية
            </h1>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            أنشئ الحملات وحدد الجمهور وتابع حالة التنفيذ
            من مكان واحد.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadCampaigns}
            disabled={loading}
          >
            <RefreshCw
              className={`ml-2 h-4 w-4 ${
                loading ? 'animate-spin' : ''
              }`}
            />
            تحديث
          </Button>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                حملة جديدة
              </Button>
            </DialogTrigger>

            <DialogContent
              className="max-w-2xl"
              dir="rtl"
            >
              <DialogHeader>
                <DialogTitle>
                  إنشاء حملة جديدة
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>اسم الحملة</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    placeholder="مثال: حملة عروض سبتمبر"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>القناة</Label>

                    <Select
                      value={form.channel}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          channel: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {CHANNELS.map((channel) => (
                          <SelectItem
                            key={channel.value}
                            value={channel.value}
                          >
                            {channel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      حالة العملاء
                    </Label>

                    <Select
                      value={
                        form.status || 'all'
                      }
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          status:
                            value === 'all'
                              ? ''
                              : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="كل الحالات" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">
                          كل الحالات
                        </SelectItem>

                        {STATUS_OPTIONS.map(
                          (status) => (
                            <SelectItem
                              key={status}
                              value={status}
                            >
                              {status}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Tag اختياري
                  </Label>

                  <Input
                    value={form.tag}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tag: e.target.value,
                      })
                    }
                    placeholder="مثال: vip"
                  />
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Marketing Opt-in إلزامي
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    لن يتم إدراج أي عميل لم يمنح موافقة
                    تسويقية صريحة.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    موعد التنفيذ اختياري
                  </Label>

                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scheduled_at:
                          e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    محتوى الرسالة
                  </Label>

                  <Textarea
                    value={form.message_body}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        message_body:
                          e.target.value,
                      })
                    }
                    rows={6}
                    placeholder="اكتب الرسالة التي سيتم تجهيزها للإرسال..."
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={previewAudience}
                    disabled={previewLoading}
                  >
                    {previewLoading ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="ml-2 h-4 w-4" />
                    )}

                    معاينة الجمهور
                  </Button>

                  <Button
                    type="button"
                    onClick={createCampaign}
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    إنشاء الحملة
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error */}
      {error && !dialogOpen && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">
                إجمالي الحملات
              </p>
              <p className="mt-1 text-2xl font-bold">
                {stats.total}
              </p>
            </div>

            <Megaphone className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">
                جاهزة / مجدولة
              </p>
              <p className="mt-1 text-2xl font-bold">
                {stats.scheduled}
              </p>
            </div>

            <Clock3 className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">
                مكتملة
              </p>
              <p className="mt-1 text-2xl font-bold">
                {stats.completed}
              </p>
            </div>

            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">
                بها أخطاء
              </p>
              <p className="mt-1 text-2xl font-bold">
                {stats.failed}
              </p>
            </div>

            <XCircle className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            الحملات
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-16 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />

              <h3 className="mt-4 font-semibold">
                لا توجد حملات حتى الآن
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                أنشئ أول حملة تسويقية للشركة.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-xl border p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {campaign.name}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                            campaign.status,
                          )}`}
                        >
                          {statusLabel(
                            campaign.status,
                          )}
                        </span>

                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                          {campaign.channel}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {campaign.message_body ||
                          'لا توجد رسالة'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          الجمهور:{' '}
                          {campaign.total_recipients ??
                            0}
                        </span>

                        <span className="flex items-center gap-1">
                          <Send className="h-3.5 w-3.5" />
                          في الانتظار:{' '}
                          {campaign.queued_count ??
                            0}
                        </span>

                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          تم الإرسال:{' '}
                          {campaign.sent_count ??
                            0}
                        </span>

                        <span>
                          تم التسليم:{' '}
                          {campaign.delivered_count ??
                            0}
                        </span>

                        <span>
                          فشل:{' '}
                          {campaign.failed_count ??
                            0}
                        </span>

                        <span>
                          تخطي:{' '}
                          {campaign.skipped_count ??
                            0}
                        </span>
                      </div>

                      {campaign.scheduled_at && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          موعد التنفيذ:{' '}
                          {new Date(
                            campaign.scheduled_at,
                          ).toLocaleString(
                            'ar-EG',
                          )}
                        </p>
                      )}

                      {campaign.error_message && (
                        <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                          {campaign.error_message}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {campaign.status !==
                        'ملغاة' &&
                        campaign.status !==
                          'مكتملة' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              prepareCampaign(
                                campaign,
                              )
                            }
                            disabled={
                              runningId ===
                              campaign.id
                            }
                          >
                            {runningId ===
                            campaign.id ? (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="ml-2 h-4 w-4" />
                            )}

                            تجهيز الجمهور
                          </Button>
                        )}

                      {(campaign.failed_count ??
                        0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            retryCampaign(
                              campaign,
                            )
                          }
                          disabled={
                            runningId ===
                            campaign.id
                          }
                        >
                          إعادة المحاولة
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          refreshCampaign(
                            campaign,
                          )
                        }
                        disabled={
                          runningId ===
                          campaign.id
                        }
                      >
                        <RefreshCw className="ml-2 h-4 w-4" />
                        تحديث
                      </Button>

                      {campaign.status !==
                        'مكتملة' &&
                        campaign.status !==
                          'ملغاة' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              cancelCampaign(
                                campaign,
                              )
                            }
                            disabled={
                              runningId ===
                              campaign.id
                            }
                          >
                            إلغاء
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience Preview */}
      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      >
        <DialogContent
          className="max-h-[85vh] max-w-4xl overflow-y-auto"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle>
              معاينة الجمهور
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  عدد العملاء المؤهلين
                </span>

                <span className="text-2xl font-bold">
                  {audienceCount}
                </span>
              </div>
            </div>

            {previewLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : audiencePreview.length ===
              0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                لا يوجد عملاء مؤهلون وفقًا للفلاتر
                الحالية.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 p-3 text-xs font-semibold">
                  <div className="col-span-4">
                    العميل
                  </div>
                  <div className="col-span-3">
                    الشركة
                  </div>
                  <div className="col-span-3">
                    الهاتف
                  </div>
                  <div className="col-span-2">
                    الحالة
                  </div>
                </div>

                {audiencePreview.map(
                  (customer) => (
                    <div
                      key={customer.id}
                      className="grid grid-cols-12 gap-2 border-b p-3 text-sm last:border-b-0"
                    >
                      <div className="col-span-4 truncate">
                        {customer.name}
                      </div>

                      <div className="col-span-3 truncate text-muted-foreground">
                        {customer.company ||
                          '—'}
                      </div>

                      <div className="col-span-3 truncate text-muted-foreground">
                        {customer.phone ||
                          customer.email ||
                          '—'}
                      </div>

                      <div className="col-span-2">
                        {customer.status ||
                          '—'}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              المعاينة تعرض حتى 100 عميل فقط. العدد
              الإجمالي في الأعلى هو عدد العملاء المؤهلين
              حسب الفلاتر.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
