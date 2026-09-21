import { createDecipheriv, createHash } from 'node:crypto'
const env=(...names:string[])=>names.map(n=>process.env[n]).find(v=>v?.trim())?.trim()||''
const text=(v:unknown,max=4000)=>typeof v==='string'?v.trim().slice(0,max):''
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{}
type GeminiPart={text?:string;inlineData?:{mimeType:string;data:string}}
const MAX_INLINE_BYTES=15*1024*1024
const SUPPORTED_INLINE=/^(?:image\/(?:png|jpe?g|webp|heic|heif|gif|avif)|audio\/(?:mpeg|mp3|wav|ogg|aac|flac|webm|mp4)|application\/pdf|text\/(?:plain|csv|markdown)|application\/json)$/iu
function decryptMetaToken(value:any){
 const seed=env('META_TOKEN_ENCRYPTION_KEY','META_APP_SECRET')
 if(!seed)return ''
 if(value&&typeof value==='object'&&value.iv&&value.tag&&value.data){try{const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(seed).digest(),Buffer.from(String(value.iv),'base64'));decipher.setAuthTag(Buffer.from(String(value.tag),'base64'));return Buffer.concat([decipher.update(Buffer.from(String(value.data),'base64')),decipher.final()]).toString('utf8')}catch{return ''}}
 return typeof value==='string'?value:''
}

function attachmentList(metadata:any){
 const candidates=[metadata?.attachments,metadata?.files,metadata?.media,metadata?.file,metadata?.attachment,metadata?.media_url||metadata?.url?metadata:null]
 for(const value of candidates){
  if(Array.isArray(value)&&value.length)return value.map(obj)
  if(value&&typeof value==='object')return [obj(value)]
 }
 return []
}

async function whatsappMediaUrl(supabase:any,organizationId:string,mediaId:string){
 const {data:integration}=await supabase.from('integrations').select('config').eq('organization_id',organizationId).eq('provider','whatsapp').eq('connected',true).maybeSingle()
 const token=decryptMetaToken(obj(integration?.config).access_token)
 if(!token)return ''
 const graphVersion=text(process.env.META_GRAPH_API_VERSION,30)||'v23.0'
 const r=await fetch('https://graph.facebook.com/'+graphVersion+'/'+encodeURIComponent(mediaId),{headers:{Authorization:'Bearer '+token}})
 const data=await r.json().catch(()=>({}))
 return r.ok?text(data?.url,5000):''
}

async function metaAccessToken(supabase:any,organizationId:string,channel:string){
 const provider=/^instagram$/iu.test(channel)?'instagram':/^whatsapp$/iu.test(channel)?'whatsapp':'facebook'
 const {data:integration}=await supabase.from('integrations').select('config').eq('organization_id',organizationId).eq('provider',provider).eq('connected',true).maybeSingle()
 return decryptMetaToken(obj(integration?.config).access_token)
}
async function fetchAttachment(supabase:any,organizationId:string,channel:string,attachment:any){
 const mime=text(attachment.mime_type||attachment.mimeType||attachment.type,120).toLowerCase().split(';')[0].trim()
 const mediaId=text(attachment.media_id||attachment.mediaId||attachment.id,300)
 let url=text(attachment.url||attachment.media_url||attachment.mediaUrl||attachment.download_url,5000)
 if(!url&&mediaId&&/^whatsapp$/iu.test(channel))url=await whatsappMediaUrl(supabase,organizationId,mediaId)
 let base64=text(attachment.base64||attachment.data,30000000).replace(/^data:[^;]+;base64,/i,'')
 if(base64)return {mime:mime||'application/octet-stream',base64,bytes:Math.floor(base64.length*0.75)}
 if(!url)return {error:'missing_media_url'}
 const headers:Record<string,string>={}
 const token=await metaAccessToken(supabase,organizationId,channel)
 if(token&&/^(whatsapp|facebook|messenger|instagram)$/iu.test(channel))headers.Authorization='Bearer '+token
 const r=await fetch(url,{headers})
 if(!r.ok)return {error:'media_fetch_'+r.status}
 const buffer=Buffer.from(await r.arrayBuffer())
 const headerMime=(r.headers.get('content-type')||'').split(';')[0].toLowerCase().trim()
 const declaredMime=mime||''
 const detected=(declaredMime&&/^audio\//i.test(declaredMime))?declaredMime:(headerMime&&headerMime!=='application/octet-stream'?headerMime:(declaredMime||headerMime||'application/octet-stream'))
 return {mime:detected,base64:buffer.toString('base64'),bytes:buffer.byteLength}
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const transientStatus=(status:number)=>status===408||status===425||status===429||status>=500
const retryDelay=(attempt:number)=>Math.min(4000,500*Math.pow(2,attempt)+Math.floor(Math.random()*400))
async function transcribeAudio(apiKey:string,model:string,audio:{mime:string;base64:string}){
 const candidates=[model,'gemini-3.6-flash','gemini-3.5-flash-lite','gemini-2.5-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i)
 let last='audio transcription failed'
 for(const candidate of candidates){
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000)
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(candidate)+':generateContent?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({contents:[{role:'user',parts:[{text:'استمع للتسجيل الصوتي جيداً. اكتب فقط النص المنطوق كما قاله العميل، بنفس اللغة قدر الإمكان، بدون شرح أو تلخيص.'},{inlineData:{mimeType:audio.mime,data:audio.base64}}]}],generationConfig:{maxOutputTokens:1200}})})
    const data=await r.json().catch(()=>({}))
    if(r.ok){
     const out=text(data?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||'').join(''),5000)
     if(out)return out
     last=candidate+' returned an empty audio transcript'
     if(attempt<2){await sleep(retryDelay(attempt));continue}
     break
    }
    last=text(data?.error?.message,500)||'Gemini '+r.status
    if(transientStatus(r.status)&&attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }catch(error:any){
    last=error?.name==='AbortError'?candidate+' audio request timed out':text(error?.message,500)||last
    if(attempt<2){await sleep(retryDelay(attempt));continue}
    break
   }finally{clearTimeout(timeout)}
  }
 }
 throw new Error(last)
}

export async function prepareRyanMultimodal(supabase:any,organizationId:string,channel:string,metadata:any,apiKey:string,model:string){
 const attachments=attachmentList(metadata)
 if(!attachments.length)return {currentText:'',parts:[] as GeminiPart[],attachmentSummary:[] as any[],transcript:''}
 const parts:GeminiPart[]=[]
 const summaries:any[]=[]
 let transcript=''
 for(const attachment of attachments.slice(0,4)){
  const fetched=await fetchAttachment(supabase,organizationId,channel,attachment)
  if(fetched.error){summaries.push({type:'unsupported',reason:fetched.error});continue}
  if(!fetched.mime||!SUPPORTED_INLINE.test(fetched.mime)){summaries.push({type:'unsupported',mime:fetched.mime});continue}
  if(fetched.bytes>MAX_INLINE_BYTES){summaries.push({type:'too_large',mime:fetched.mime,bytes:fetched.bytes});continue}
  if(/^audio\//iu.test(fetched.mime)){
   parts.push({inlineData:{mimeType:fetched.mime,data:fetched.base64}})
   try{
    const audioText=await transcribeAudio(apiKey,model,{mime:fetched.mime,base64:fetched.base64})
    transcript=[transcript,audioText].filter(Boolean).join('\n')
    summaries.push({type:'audio',mime:fetched.mime,transcribed:true})
   }catch(error:any){
    summaries.push({type:'audio',mime:fetched.mime,transcribed:false,error:text(error?.message,300)||'transcription_failed'})
   }
  }else{parts.push({inlineData:{mimeType:fetched.mime,data:fetched.base64}});summaries.push({type:/^image\//iu.test(fetched.mime)?'image':fetched.mime==='application/pdf'?'pdf':'file',mime:fetched.mime})}
 }
 const attachmentText=summaries.length?'\n[مرفقات العميل: '+summaries.map(x=>x.type+(x.mime?' ('+x.mime+')':'')).join('، ')+']':''
 return {currentText:transcript?transcript+attachmentText:attachmentText,parts,attachmentSummary:summaries,transcript}
}
// Meta CDN auth fix deployed
