import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'الإعدادات غير مكتملة' })
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const results: any[] = []

  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('active', true)
    .eq('trigger_event', 'lead_stale')

  for (const automation of automations || []) {
    const hours = automation.config?.hours ?? 24
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const { data: staleLeads } = await supabase
      .from('leads')
      .select('id, name')
      .eq('organization_id', automation.organization_id)
      .eq('status', 'جديد')
      .lte('created_at', cutoff)

    for (const lead of staleLeads || []) {
      const { data: existingRun } = await supabase
        .from('automation_runs')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('target_id', lead.id)
        .maybeSingle()

      if (existingRun) continue

      const titleTemplate = automation.action_config?.title_template || 'تابع مع {name} - عميل محتمل بدون رد'
      const title = titleTemplate.replace('{name}', lead.name)

      const { error: taskError } = await supabase.from('tasks').insert({
        organization_id: automation.organization_id,
        title,
        priority: automation.action_config?.priority || 'عالية',
        status: 'قيد التنفيذ',
        due_date: new Date().toISOString().slice(0, 10),
      })

      if (!taskError) {
        await supabase.from('automation_runs').insert({
          automation_id: automation.id,
          target_table: 'leads',
          target_id: lead.id,
        })
        results.push({ lead: lead.name, action: 'task_created' })
      }
    }
  }

  res.status(200).json({ processed: results.length, results })
}
