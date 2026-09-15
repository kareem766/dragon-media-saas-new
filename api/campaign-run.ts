import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

const url = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY!
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

function json(res: VercelResponse, status: number, data: unknown) { return res.status(status).json(data) }
function secretEqual(a: string, b: string) { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y) }

async function sessionOrg(req: VercelRequest) {
  const auth = String(req.headers.authorization || '')
  if (!auth.startsWith('Bearer ')) return null
  const { data: { user } } = await db.auth.getUser(auth.slice(7).trim())
  if (!user) return null
  const { data: profile } = await db.from('users').select('id,organization_id,active').eq('id',user.id).maybeSingle()
  if (!profile?.organization_id || profile.active === false) return null
  return { user, organizationId: profile.organization_id }
}

function normalizeFilter(input: any) {
  const f = input && typeof input === 'object' ? input : {}
  return {
    status: typeof f.status === 'string' && f.status.trim() ? f.status.trim() : null,
    tag: typeof f.tag === 'string' && f.tag.trim() ? f.tag.trim().toLowerCase() : null,
    marketing_opt_in: f.marketing_opt_in !== false && f.optedInOnly !== false,
  }
}

async function audience(organizationId: string, filter: any) {
  let q = db.from('customers').select('id,name,company,phone,email,status,tags,marketing_opt_in').eq('organization_id',organizationId)
  if (filter.marketing_opt_in) q=q.eq('marketing_opt_in',true)
  if (filter.status && filter.status !== 'all') q=q.eq('status',filter.status)
  const { data, error } = await q.limit(10000)
  if (error) throw error
  return (data || []).filter((c:any)=>!filter.tag || (Array.isArray(c.tags) && c.tags.some((t:string)=>t.toLowerCase()===filter.tag)))
}

async function counts(campaignId:string, organizationId:string) {
  const { data, error } = await db.from('campaign_messages').select('status').eq('campaign_id',campaignId).eq('organization_id',organizationId)
  if (error) throw error
  const rows=data||[]
  const out={total_recipients:rows.length,queued_count:rows.filter(r=>['قيد الإرسال','جاهزة','queued'].includes(r.status)).length,sent_count:rows.filter(r=>['تم الإرسال','sent'].includes(r.status)).length,delivered_count:rows.filter(r=>['تم التسليم','delivered'].includes(r.status)).length,failed_count:rows.filter(r=>['فشلت','failed'].includes(r.status)).length,skipped_count:rows.filter(r=>['تم التخطي','skipped'].includes(r.status)).length}
  await db.from('campaigns').update({...out,updated_at:new Date().toISOString()}).eq('id',campaignId).eq('organization_id',organizationId)
  return out
}

async function prepare(campaign:any) {
  const filter=normalizeFilter(campaign.audience_filter)
  const rows=await audience(campaign.organization_id,filter)
  const now=new Date().toISOString()
  await db.from('campaigns').update({status:'جارٍ التحضير',audience_preview_count:rows.length,error_message:null,updated_at:now}).eq('id',campaign.id).eq('organization_id',campaign.organization_id)
  if (!rows.length) { await db.from('campaigns').update({status:'جاهزة',total_recipients:0,queued_count:0,sent_count:0,delivered_count:0,failed_count:0,skipped_count:0,updated_at:now}).eq('id',campaign.id); return {count:0} }
  const queue=rows.map((c:any)=>({campaign_id:campaign.id,customer_id:c.id,organization_id:campaign.organization_id,channel:campaign.channel,message_body:campaign.message_body,content:campaign.message_body,status:'قيد الإرسال',opt_in:c.marketing_opt_in===true,queued_at:now,attempts:0}))
  const { error }=await db.from('campaign_messages').upsert(queue,{onConflict:'campaign_id,customer_id',ignoreDuplicates:true})
  if(error){await db.from('campaigns').update({status:'فشل',error_message:error.message,updated_at:new Date().toISOString()}).eq('id',campaign.id);throw error}
  const c=await counts(campaign.id,campaign.organization_id)
  await db.from('campaigns').update({status:'جاهزة',...c,audience_preview_count:rows.length,updated_at:new Date().toISOString()}).eq('id',campaign.id)
  return {count:rows.length,counts:c}
}

async function sendWhatsApp(campaign:any, row:any, connection:any) {
  const phone=String(row.customer?.phone||'').replace(/\D/g,'')
  if(!phone) throw new Error('رقم العميل غير موجود')
  if(campaign.template_name) {
    const components=Array.isArray(campaign.template_components)?campaign.template_components:[]
    const body:any={messaging_product:'whatsapp',to:phone,type:'template',template:{name:campaign.template_name,language:{code:campaign.template_language||'ar'},components}}
    const r=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION||'v23.0'}/${connection.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${connection.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
    const p=await r.json().catch(()=>({}))
    if(!r.ok) throw new Error(p?.error?.message||'WhatsApp template send failed')
    return p?.messages?.[0]?.id
  }
  const recent=row.recentInboundAt?new Date(row.recentInboundAt).getTime():0
  if(!recent || Date.now()-recent>24*60*60*1000) throw new Error('رسالة نصية خارج نافذة 24 ساعة؛ أضف Template معتمد من Meta للحملة')
  const r=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION||'v23.0'}/${connection.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${connection.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phone,type:'text',text:{preview_url:false,body:campaign.message_body}})})
  const p=await r.json().catch(()=>({}))
  if(!r.ok) throw new Error(p?.error?.message||'WhatsApp send failed')
  return p?.messages?.[0]?.id
}

async function worker(campaignId:string) {
  const { data: campaign, error: ce }=await db.from('campaigns').select('*').eq('id',campaignId).maybeSingle()
  if(ce||!campaign) throw new Error('Campaign not found')
  if(['مكتملة','ملغاة'].includes(campaign.status)) return {processed:0}
  if(campaign.status==='مسودة') await prepare(campaign)
  const { data: connection }=await db.from('meta_connections').select('access_token,phone_number_id,status').eq('organization_id',campaign.organization_id).eq('provider','whatsapp').eq('status','connected').order('updated_at',{ascending:false}).limit(1).maybeSingle()
  const limit=20
  const { data: queued, error }=await db.from('campaign_messages').select('id,customer_id,attempts,status,content,message_body').eq('campaign_id',campaignId).eq('organization_id',campaign.organization_id).in('status',['قيد الإرسال','جاهزة']).order('queued_at',{ascending:true}).limit(limit)
  if(error) throw error
  let processed=0
  for(const item of queued||[]) {
    const { data: customer }=await db.from('customers').select('id,phone').eq('id',item.customer_id).eq('organization_id',campaign.organization_id).maybeSingle()
    if(!customer) { await db.from('campaign_messages').update({status:'تم التخطي',skipped_at:new Date().toISOString(),skipped_reason:'العميل غير موجود',updated_at:new Date().toISOString()}).eq('id',item.id); continue }
    const { data: recent }=await db.from('messages').select('created_at').eq('conversation_id', (await db.from('conversations').select('id').eq('organization_id',campaign.organization_id).eq('customer_id',customer.id).eq('channel','whatsapp').order('updated_at',{ascending:false}).limit(1).maybeSingle()).data?.id || '00000000-0000-0000-0000-000000000000').eq('sender_type','customer').order('created_at',{ascending:false}).limit(1).maybeSingle()
    try {
      if(campaign.channel!=='whatsapp') throw new Error('هذه القناة تحتاج موصل إرسال مخصص؛ لم يتم احتسابها كإرسال ناجح')
      if(!connection?.access_token||!connection.phone_number_id) throw new Error('اتصال WhatsApp غير جاهز')
      const externalId=await sendWhatsApp(campaign,{customer,recentInboundAt:recent?.created_at},connection)
      await db.from('campaign_messages').update({status:'تم الإرسال',external_id:externalId||null,sent_at:new Date().toISOString(),attempts:(item.attempts||0)+1,error_message:null,updated_at:new Date().toISOString()}).eq('id',item.id)
    } catch(e:any) {
      const attempts=(item.attempts||0)+1
      const retry=attempts<3
      await db.from('campaign_messages').update({status:retry?'قيد الإرسال':'فشلت',attempts,failed_at:retry?null:new Date().toISOString(),error_message:String(e?.message||e),updated_at:new Date().toISOString()}).eq('id',item.id)
    }
    processed++
  }
  const c=await counts(campaignId,campaign.organization_id)
  const remaining=c.queued_count
  await db.from('campaigns').update({status:remaining?'قيد الإرسال':'مكتملة',completed_at:remaining?null:new Date().toISOString(),last_run_at:new Date().toISOString(),...c,updated_at:new Date().toISOString()}).eq('id',campaignId)
  return {processed,counts:c}
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  res.setHeader('Cache-Control','no-store')
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'})
  try{
    if(!url||!serviceKey) return json(res,500,{error:'Campaign service environment variables are missing'})
    const body=req.body||{}
    const action=String(body.action||'')
    const campaignId=String(body.campaignId||'')
    if(action==='worker'){
      const supplied=String(req.headers['x-campaign-worker-secret']||'')
      const {data:secretRow}=await db.from('system_secrets').select('value').eq('key','campaign_worker_webhook_secret').maybeSingle()
      if(!secretRow?.value||!secretEqual(supplied,String(secretRow.value))) return json(res,401,{error:'Unauthorized'})
      if(!campaignId) return json(res,400,{error:'campaignId is required'})
      return json(res,200,{success:true,...await worker(campaignId)})
    }
    const session=await sessionOrg(req)
    if(!session) return json(res,401,{error:'Unauthorized'})
    if(action==='preview'){
      const rows=await audience(session.organizationId,normalizeFilter(body.filter||{}))
      return json(res,200,{success:true,count:rows.length,customers:rows.slice(0,100)})
    }
    if(!campaignId) return json(res,400,{error:'campaignId is required'})
    const {data:campaign}=await db.from('campaigns').select('*').eq('id',campaignId).eq('organization_id',session.organizationId).maybeSingle()
    if(!campaign) return json(res,404,{error:'Campaign not found'})
    if(action==='prepare') return json(res,200,{success:true,...await prepare(campaign)})
    if(action==='start'){
      if(campaign.status==='مسودة') await prepare(campaign)
      await db.from('campaigns').update({status:'قيد الإرسال',started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',campaignId).eq('organization_id',session.organizationId)
      const {data:secretRow}=await db.from('system_secrets').select('value').eq('key','campaign_worker_webhook_secret').maybeSingle()
      const r=await fetch(`${process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'https://dragon-media-saas-new.vercel.app'}/api/campaign-run`,{method:'POST',headers:{'Content-Type':'application/json','X-Campaign-Worker-Secret':String(secretRow?.value||'')},body:JSON.stringify({action:'worker',campaignId})})
      const result=await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(result?.error||'Campaign worker failed')
      return json(res,200,result)
    }
    if(action==='cancel'){
      await db.from('campaigns').update({status:'ملغاة',cancelled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',campaignId).eq('organization_id',session.organizationId)
      return json(res,200,{success:true})
    }
    if(action==='retry_failed'){
      await db.from('campaign_messages').update({status:'قيد الإرسال',error_message:null,failed_at:null,queued_at:new Date().toISOString()}).eq('campaign_id',campaignId).eq('organization_id',session.organizationId).in('status',['فشلت','failed'])
      await db.from('campaigns').update({status:'قيد الإرسال',updated_at:new Date().toISOString()}).eq('id',campaignId).eq('organization_id',session.organizationId)
      return json(res,200,{success:true,...await worker(campaignId)})
    }
    if(action==='refresh') return json(res,200,{success:true,counts:await counts(campaignId,session.organizationId)})
    return json(res,400,{error:`Unsupported action: ${action}`})
  }catch(e:any){console.error('Campaign engine error',e);return json(res,500,{error:e?.message||'Unexpected campaign engine error'})}
}
