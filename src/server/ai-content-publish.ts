import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
const env = (...names:string[]) => names.map(n=>process.env[n]).find(v=>v?.trim())?.trim() || ''
const text=(v:unknown,max=12000)=>String(v??'').trim().slice(0,max)
const json=(res:VercelResponse,status:number,body:unknown)=>res.status(status).json(body)

function decryptToken(value:any){
  if(!value?.iv||!value?.tag||!value?.data) throw new Error('Meta access token غير متاح.')
  const seed=env('META_TOKEN_ENCRYPTION_KEY','META_APP_SECRET')
  const key=createHash('sha256').update(seed).digest()
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(String(value.iv),'base64'))
  decipher.setAuthTag(Buffer.from(String(value.tag),'base64'))
  return Buffer.concat([decipher.update(Buffer.from(String(value.data),'base64')),decipher.final()]).toString('utf8')
}
async function graph(path:string,token:string,body:Record<string,unknown>){
  const response=await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
  const data=await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(text(data?.error?.message,500)||`Meta request failed (${response.status})`)
  return data
}
async function auth(req:VercelRequest,db:any){
  const raw=String(req.headers.authorization||''); const token=raw.startsWith('Bearer ')?raw.slice(7).trim():''
  if(!token) throw new Error('Authentication required.')
  const {data,error}=await db.auth.getUser(token)
  if(error||!data.user) throw new Error('جلسة الدخول غير صالحة.')
  return data.user.id
}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'})
  try{
    const url=env('SUPABASE_URL','VITE_SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY')
    if(!url||!key) return json(res,500,{error:'Server configuration is incomplete.'})
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
    const userId=await auth(req,db)
    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{})
    const id=text(body.id,100), platforms=Array.isArray(body.platforms)?body.platforms.map((x:any)=>text(x,30).toLowerCase()).filter(Boolean):[]
    if(!id||!platforms.length) return json(res,400,{error:'اختر منصة نشر واحدة على الأقل.'})
    const {data:user}=await db.from('users').select('organization_id,role,active').eq('id',userId).maybeSingle()
    if(!user?.organization_id||user.active===false) throw new Error('الحساب غير مرتبط بمساحة عمل نشطة.')
    const {data:permission}=await db.from('role_permissions').select('can_edit').eq('role',user.role).eq('resource','ai_content').maybeSingle()
    if(!permission?.can_edit) return json(res,403,{error:'ليس لديك صلاحية نشر المحتوى.'})
    const {data:post,error:postError}=await db.from('ai_content_posts').select('*').eq('id',id).eq('organization_id',user.organization_id).maybeSingle()
    if(postError||!post) return json(res,404,{error:'المحتوى غير موجود.'})
    const caption=[post.hook,post.content,post.cta].filter(Boolean).join('\n\n')
    const results:any={...(post.publish_results||{})}
    for(const platform of platforms){
      try{
        if(platform==='facebook'){
          const {data:integration}=await db.from('integrations').select('config,metadata,connected,status').eq('organization_id',user.organization_id).eq('provider','facebook').maybeSingle()
          if(!integration?.connected||integration.status!=='connected') throw new Error('Facebook غير متصل.')
          const pageId=text(integration.metadata?.facebook_page_id,100)
          if(!pageId) throw new Error('لم يتم تحديد صفحة Facebook.')
          const token=decryptToken(integration.config?.access_token)
          const response=post.image_url
            ? await graph(`/${encodeURIComponent(pageId)}/photos`,token,{url:post.image_url,caption,published:true})
            : await graph(`/${encodeURIComponent(pageId)}/feed`,token,{message:caption,published:true})
          results.facebook={status:'published',id:text(response?.post_id||response?.id,200),published_at:new Date().toISOString()}
        }else if(platform==='instagram'){
          const {data:integration}=await db.from('integrations').select('config,metadata,connected,status').eq('organization_id',user.organization_id).eq('provider','instagram').maybeSingle()
          if(!integration?.connected||integration.status!=='connected') throw new Error('Instagram غير متصل. اربطه أولًا من اتصالات Meta.')
          const igUserId=text(integration.metadata?.instagram_user_id||integration.metadata?.ig_user_id,100)
          if(!igUserId) throw new Error('حساب Instagram غير مؤهل للنشر أو لم يتم حفظ Instagram User ID.')
          const token=decryptToken(integration.config?.access_token)
          if(!post.image_url) throw new Error('Instagram يحتاج صورة للبوست، وستتوفر خدمة توليد الصور قريبًا على منصة دراجون ميديا.')
          const container=await graph(`/${encodeURIComponent(igUserId)}/media`,token,{image_url:post.image_url,caption,media_type:'IMAGE'})
          const creationId=text(container?.id,200)
          if(!creationId) throw new Error('تعذر إنشاء حاوية Instagram.')
          const published=await graph(`/${encodeURIComponent(igUserId)}/media_publish`,token,{creation_id:creationId})
          results.instagram={status:'published',id:text(published?.id,200),creation_id:creationId,published_at:new Date().toISOString()}
        }else throw new Error('المنصة غير مدعومة.')
      }catch(error){results[platform]={status:'failed',error:error instanceof Error?error.message:'فشل النشر'}}
    }
    const published=Object.values(results).some((x:any)=>x?.status==='published')
    const failed=Object.values(results).some((x:any)=>x?.status==='failed')
    const status=published?(failed?'published':'published'):(failed?'failed':'ready')
    const {data:updated,error:updateError}=await db.from('ai_content_posts').update({target_platforms:platforms,publish_results:results,status,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',user.organization_id).select('*').single()
    if(updateError) throw updateError
    return json(res,200,{post:updated,results})
  }catch(error){
    console.error('AI content publish failed',error)
    const message=error instanceof Error?error.message:'فشل النشر.'
    return json(res,message==='Authentication required.'||message.includes('جلسة')?401:400,{error:message})
  }
}
