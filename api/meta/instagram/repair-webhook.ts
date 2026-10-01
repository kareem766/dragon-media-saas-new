import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHash, createDecipheriv } from 'node:crypto'

const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v?.trim())?.trim()||''
const json=(res:VercelResponse,status:number,body:unknown)=>res.status(status).json(body)

function decryptToken(value:any){
  if(typeof value==='string') return value
  if(!value?.iv||!value?.tag||!value?.data) return ''
  const seed=env('META_TOKEN_ENCRYPTION_KEY','META_APP_SECRET')
  if(!seed) return ''
  try{
    const key=createHash('sha256').update(seed).digest()
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(String(value.iv),'base64'))
    decipher.setAuthTag(Buffer.from(String(value.tag),'base64'))
    return Buffer.concat([decipher.update(Buffer.from(String(value.data),'base64')),decipher.final()]).toString('utf8')
  }catch{return ''}
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'})
  try{
    const authorization=String(req.headers.authorization||'')
    const accessToken=authorization.startsWith('Bearer ')?authorization.slice(7).trim():''
    if(!accessToken) return json(res,401,{error:'جلسة الدخول غير موجودة.'})
    const supabaseUrl=env('SUPABASE_URL','VITE_SUPABASE_URL'), serviceKey=env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY')
    const appId=env('INSTAGRAM_APP_ID','META_INSTAGRAM_APP_ID'), graphVersion=env('META_GRAPH_API_VERSION')||'v26.0'
    if(!supabaseUrl||!serviceKey||!appId) return json(res,500,{error:'إعدادات Instagram أو Supabase غير مكتملة.'})
    const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:userData,error:userError}=await db.auth.getUser(accessToken)
    if(userError||!userData.user) return json(res,401,{error:'جلسة الدخول غير صالحة.'})
    const {data:membership}=await db.from('users').select('organization_id,active,role').eq('id',userData.user.id).maybeSingle()
    if(!membership?.organization_id||membership.active===false) return json(res,403,{error:'الحساب غير مرتبط بشركة نشطة.'})
    const {data:integration,error:integrationError}=await db.from('integrations').select('config,metadata').eq('organization_id',String(membership.organization_id)).eq('provider','instagram').eq('connected',true).maybeSingle()
    if(integrationError) throw integrationError
    if(!integration) return json(res,404,{error:'لا يوجد اتصال Instagram متصل.'})
    const token=decryptToken(integration.config?.access_token)
    const instagramUserId=String(integration.metadata?.instagram_user_id||'')
    if(!token||!instagramUserId) return json(res,400,{error:'بيانات اتصال Instagram غير مكتملة.'})
    const subscribeUrl='https://graph.instagram.com/'+encodeURIComponent(instagramUserId)+'/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks'
    const subscribe=await fetch(subscribeUrl,{method:'POST',headers:{Authorization:'Bearer '+token}})
    const subscribePayload=await subscribe.json().catch(()=>({}))
    if(!subscribe.ok) return json(res,502,{error:String(subscribePayload?.error?.message||'Meta رفضت اشتراك Instagram Webhook.'),meta_code:subscribePayload?.error?.code??null})
    const currentResponse=await fetch('https://graph.instagram.com/'+encodeURIComponent(instagramUserId)+'/subscribed_apps',{headers:{Authorization:'Bearer '+token}})
    const current=await currentResponse.json().catch(()=>({}))
    const apps=Array.isArray(current?.data)?current.data:[]
    const row=apps.find((item:any)=>String(item?.id||item?.app_id||'')===String(appId))
    const fields=Array.isArray(row?.subscribed_fields)?row.subscribed_fields.map(String):[]
    const ready=fields.includes('comments')&&fields.includes('messages')
    await db.from('integrations').update({metadata:{...integration.metadata,instagram_webhook_subscribed:ready,instagram_webhook_fields:fields,ready_for_messaging:ready},last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString(),error_message:ready?null:'Meta لم تؤكد اشتراك comments/messages.'}).eq('organization_id',String(membership.organization_id)).eq('provider','instagram')
    return json(res,200,{ok:true,subscribed:ready,fields})
  }catch(error){
    console.error('Instagram webhook repair failed',error)
    return json(res,500,{error:error instanceof Error?error.message:'تعذر إصلاح Instagram Webhook.'})
  }
}
