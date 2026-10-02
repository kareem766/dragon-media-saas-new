import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

const env = (...names:string[]) => names.map(n=>process.env[n]).find(v=>v?.trim())?.trim() || ''
const APP_URL = env('APP_URL','VITE_APP_URL') || 'https://dragon-media-saas-new.vercel.app'
const db = () => createClient(env('SUPABASE_URL','VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'), { auth:{persistSession:false,autoRefreshToken:false} })
const json=(res:VercelResponse,status:number,body:unknown)=>res.status(status).json(body)
const text=(v:unknown,max=2000)=>typeof v==='string'?v.trim().slice(0,max):''
const secretKey=()=>createHash('sha256').update(env('META_TOKEN_ENCRYPTION_KEY','META_APP_SECRET','SUPABASE_SERVICE_ROLE_KEY')).digest()
function encrypt(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',secretKey(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}}
function decrypt(value:any){if(typeof value==='string')return value;if(!value?.iv||!value?.tag||!value?.data)return '';try{const decipher=createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(String(value.iv),'base64'));decipher.setAuthTag(Buffer.from(String(value.tag),'base64'));return Buffer.concat([decipher.update(Buffer.from(String(value.data),'base64')),decipher.final()]).toString('utf8')}catch{return ''}}
async function telegram(token:string,method:string,body:Record<string,unknown>={}){const r=await fetch('https://api.telegram.org/bot'+encodeURIComponent(token)+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const p=await r.json().catch(()=>({}));if(!r.ok||p?.ok!==true)throw new Error(String(p?.description||'Telegram API request failed.'));return p.result}
async function authUser(req:VercelRequest){const auth=String(req.headers.authorization||'');const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';if(!token)throw new Error('UNAUTHORIZED');const client=db();const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new Error('UNAUTHORIZED');const {data:membership}=await client.from('users').select('organization_id,active').eq('id',data.user.id).maybeSingle();if(!membership?.organization_id||membership.active===false)throw new Error('FORBIDDEN');return {userId:data.user.id,organizationId:String(membership.organization_id)}}
function constantTime(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
async function connect(req:VercelRequest,res:VercelResponse){
  let auth;try{auth=await authUser(req)}catch(e){return json(res,String(e).includes('UNAUTHORIZED')?401:403,{error:String(e).includes('UNAUTHORIZED')?'Unauthorized':'Forbidden'})}
  const token=text(req.body?.bot_token,300)
  if(!token)return json(res,400,{error:'أدخل Bot Token الخاص بـTelegram.'})
  try{
    const bot=await telegram(token,'getMe')
    const botId=String(bot?.id||''); const botUsername=text(bot?.username,120)
    if(!botId)return json(res,400,{error:'Telegram لم يرجع بيانات البوت.'})
    const webhookSecret=randomBytes(24).toString('base64url')
    const webhookUrl=APP_URL.replace(/\/$/,'')+'/api/telegram?org='+encodeURIComponent(auth.organizationId)
    const webhook=await telegram(token,'setWebhook',{url:webhookUrl,secret_token:webhookSecret,allowed_updates:['message'],drop_pending_updates:false})
    if(!webhook)return json(res,502,{error:'تعذر تفعيل Telegram Webhook.'})
    const client=db()
    const {error}=await client.from('integrations').upsert({
      organization_id:auth.organizationId,provider:'telegram',connected:true,status:'connected',
      config:{access_token:encrypt(token)},
      metadata:{telegram_bot_id:botId,telegram_bot_username:botUsername,telegram_webhook_secret:webhookSecret,telegram_webhook_url:webhookUrl,ready_for_messaging:true},
      connected_at:new Date().toISOString(),last_verified_at:new Date().toISOString(),error_message:null,updated_at:new Date().toISOString()
    },{onConflict:'organization_id,provider'})
    if(error)throw error
    return json(res,200,{ok:true,bot:{id:botId,username:botUsername},webhook_url:webhookUrl})
  }catch(error){return json(res,400,{error:error instanceof Error?error.message:'تعذر ربط Telegram.'})}
}
async function disconnect(req:VercelRequest,res:VercelResponse){
  let auth;try{auth=await authUser(req)}catch(e){return json(res,String(e).includes('UNAUTHORIZED')?401:403,{error:String(e).includes('UNAUTHORIZED')?'Unauthorized':'Forbidden'})}
  const client=db();const {data:integration}=await client.from('integrations').select('id,config').eq('organization_id',auth.organizationId).eq('provider','telegram').maybeSingle()
  if(!integration)return json(res,200,{ok:true,disconnected:true})
  const token=decrypt(integration.config?.access_token)
  if(token){try{await telegram(token,'deleteWebhook',{drop_pending_updates:false})}catch{}}
  const {error}=await client.from('integrations').update({connected:false,status:'disconnected',config:null,error_message:null,updated_at:new Date().toISOString()}).eq('id',integration.id)
  if(error)return json(res,500,{error:error.message})
  return json(res,200,{ok:true,disconnected:true})
}
async function send(req:VercelRequest,res:VercelResponse){
  let auth:any
  try{auth=await authUser(req)}catch(e){
    const internal=text(req.headers['x-ryan-inbox-secret'],500)
    const client=db(); const {data:row}=await client.from('system_secrets').select('value').eq('key','ai_agent_inbox_secret').maybeSingle()
    if(!internal||!row?.value||!constantTime(internal,String(row.value))) return json(res,String(e).includes('UNAUTHORIZED')?401:403,{error:String(e).includes('UNAUTHORIZED')?'Unauthorized':'Forbidden'})
    const organizationId=text(req.body?.organization_id,100); if(!organizationId)return json(res,400,{error:'organization_id مطلوب.'})
    auth={organizationId}
  }
  const messageId=text(req.body?.message_id,100)
  if(!messageId)return json(res,400,{error:'message_id مطلوب.'})
  const client=db()
  const {data:message,error:messageError}=await client.from('messages').select('id,conversation_id,content,sender_type,metadata').eq('id',messageId).maybeSingle()
  if(messageError||!message)return json(res,404,{error:'الرسالة غير موجودة.'})
  const {data:conversation}=await client.from('conversations').select('id,organization_id,channel,customer_id,metadata').eq('id',message.conversation_id).eq('organization_id',auth.organizationId).maybeSingle()
  if(!conversation||String(conversation.channel)!=='telegram')return json(res,400,{error:'المحادثة ليست Telegram.'})
  const chatId=String(conversation.metadata?.telegram_chat_id||'');if(!chatId)return json(res,400,{error:'Telegram chat_id غير موجود.'})
  const {data:integration}=await client.from('integrations').select('config').eq('organization_id',auth.organizationId).eq('provider','telegram').eq('connected',true).maybeSingle()
  const token=decrypt(integration?.config?.access_token);if(!token)return json(res,400,{error:'Telegram غير متصل.'})
  try{const sent=await telegram(token,'sendMessage',{chat_id:chatId,text:text(message.content,4096)});await client.from('messages').update({external_id:String(sent?.message_id||''),metadata:{...(message.metadata||{}),outbound_status:'sent',telegram_message_id:sent?.message_id||null}}).eq('id',messageId);return json(res,200,{ok:true,message:sent})}catch(error){await client.from('messages').update({metadata:{...(message.metadata||{}),outbound_status:'failed',outbound_error:error instanceof Error?error.message:'Telegram send failed'}}).eq('id',messageId);return json(res,502,{error:error instanceof Error?error.message:'Telegram send failed'})}
}
async function webhook(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'})
  const organizationId=text(req.query.org,100);if(!organizationId)return json(res,404,{error:'Not found'})
  const client=db();const {data:integration}=await client.from('integrations').select('id,config,metadata,connected').eq('organization_id',organizationId).eq('provider','telegram').maybeSingle()
  if(!integration?.connected)return json(res,404,{error:'Not found'})
  const expected=text(integration.metadata?.telegram_webhook_secret,256);const received=text(req.headers['x-telegram-bot-api-secret-token'],256)
  if(!expected||!received||!constantTime(expected,received))return json(res,401,{error:'Invalid webhook secret.'})
  const update=req.body||{};const message=update?.message;if(!message?.chat?.id||!message?.from)return json(res,200,{ok:true,ignored:true})
  const externalId=String(message.message_id||update.update_id||'');if(!externalId)return json(res,200,{ok:true,ignored:true})
  const {data:existing}=await client.from('messages').select('id').eq('external_id','telegram:'+externalId).maybeSingle();if(existing)return json(res,200,{ok:true,duplicate:true})
  const chatId=String(message.chat.id);const fromId=String(message.from.id)
  const name=[text(message.from.first_name,80),text(message.from.last_name,80)].filter(Boolean).join(' ')||text(message.from.username,80)||'عميل Telegram'
  const username=text(message.from.username,120)
  const content=message.text?text(message.text,4096):message.caption?text(message.caption,4096):message.photo?'[صورة]':message.voice?'[رسالة صوتية]':message.document?'[ملف]':'[رسالة Telegram]'
  const now=new Date().toISOString()
  let {data:conversation}=await client.from('conversations').select('id,customer_id,unread_count,status').eq('organization_id',organizationId).eq('channel','telegram').filter('metadata->>telegram_user_id','eq',fromId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  let customer:any=null
  if(conversation?.customer_id){const {data}=await client.from('customers').select('id,name,phone').eq('organization_id',organizationId).eq('id',conversation.customer_id).maybeSingle();customer=data}
  if(!customer){const {data:created,error}=await client.from('customers').insert({organization_id:organizationId,name,phone:null,source:'telegram'}).select('id,name,phone').single();if(error)throw error;customer=created}
  if(!conversation){const {data:created,error}=await client.from('conversations').insert({organization_id:organizationId,customer_id:customer.id,channel:'telegram',handled_by:'ai',status:'open',unread_count:1,last_message_at:now,updated_at:now,metadata:{telegram_chat_id:chatId,telegram_user_id:fromId,telegram_username:username}}).select('id,customer_id,unread_count,status').single();if(error)throw error;conversation=created}else{await client.from('conversations').update({unread_count:Number(conversation.unread_count||0)+1,status:'open',last_message_at:now,updated_at:now,metadata:{telegram_chat_id:chatId,telegram_user_id:fromId,telegram_username:username}}).eq('id',conversation.id)}
  const {data:saved,error:saveError}=await client.from('messages').insert({conversation_id:conversation.id,sender_type:'customer',content,external_id:'telegram:'+externalId,metadata:{source:'telegram',telegram_chat_id:chatId,telegram_user_id:fromId,telegram_username:username,message_id:externalId,message_type:message.text?'text':message.photo?'image':message.voice?'voice':message.document?'document':'other'},created_at:now}).select('id').single();if(saveError)throw saveError
  const {data:secretRow}=await client.from('system_secrets').select('value').eq('key','ai_agent_inbox_secret').maybeSingle();const secret=text(secretRow?.value,500)
  if(secret){try{await fetch(APP_URL+'/api/admin/ryan-inbox',{method:'POST',headers:{'Content-Type':'application/json','x-ryan-inbox-secret':secret},body:JSON.stringify({organization_id:organizationId,conversation_id:conversation.id,message_id:saved.id})})}catch(error){console.error('Telegram Ryan dispatch failed',error)}}
  return json(res,200,{ok:true})
}
export default async function handler(req:VercelRequest,res:VercelResponse){
  try{
    if(req.method==='POST'&&req.query.action==='connect')return connect(req,res)
    if(req.method==='POST'&&req.query.action==='disconnect')return disconnect(req,res)
    if(req.method==='POST'&&req.query.action==='send')return send(req,res)
    if(req.method==='POST')return webhook(req,res)
    return json(res,405,{error:'Method not allowed.'})
  }catch(error){console.error('Telegram API failed',error);return json(res,500,{error:error instanceof Error?error.message:'Telegram integration failed.'})}
}