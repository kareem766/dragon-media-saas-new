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
 const {data:integration}=await supabase.from('integrations').select('config,metadata').eq('organization_id',organizationId).eq('provider','whatsapp').eq('connected',true).maybeSingle()
 const config=obj(integration?.config),metadata=obj(integration?.metadata)
 const token=decryptMetaToken(config.access_token)||decryptMetaToken(metadata.access_token)
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
async function fetchMetaMedia(url:string,token:string){
 let current=url
 for(let i=0;i<6;i++){
  const headers:Record<string,string>={}
  if(token)headers.Authorization='Bearer '+token
  let r=await fetch(current,{headers,redirect:'manual'})
  if(r.status>=300&&r.status<400){
   const location=r.headers.get('location')
   if(!location)return r
   const next=new URL(location,current)
   if(token&&!next.searchParams.has('access_token'))next.searchParams.set('access_token',token)
   current=next.toString()
   continue
  }
  if(!r.ok&&token&&(r.status===401||r.status===403)){
   const retry=new URL(current)
   retry.searchParams.set('access_token',token)
   r=await fetch(retry.toString(),{headers:{},redirect:'manual'})
  }
  return r
 }
 throw new Error('Meta media redirect limit exceeded')
}

async function fetchAttachment(supabase:any,organizationId:string,channel:string,attachment:any){
 const declaredMime=text(attachment.mime_type||attachment.mimeType,120).toLowerCase().split(';')[0].trim()
 const attachmentType=text(attachment.type,80).toLowerCase().trim()
 const urlHint=text(attachment.url||attachment.media_url||attachment.mediaUrl||attachment.download_url,5000).toLowerCase()
 const mime=declaredMime&&declaredMime!=='application/octet-stream'?declaredMime:attachmentType==='image'?'image/jpeg':attachmentType==='audio'?'audio/ogg':attachmentType==='video'?'video/mp4':attachmentType==='document'?'application/pdf':/\.(?:png|jpe?g|webp|gif|heic|heif|avif)(?:[?#]|$)/iu.test(urlHint)?'image/jpeg':/\.(?:ogg|mp3|wav|m4a|aac|webm)(?:[?#]|$)/iu.test(urlHint)?'audio/ogg':declaredMime
 const mediaId=text(attachment.media_id||attachment.mediaId||attachment.id,300)
 let url=text(attachment.url||attachment.media_url||attachment.mediaUrl||attachment.download_url,5000)
 if(!url&&mediaId&&(/^whatsapp$/iu.test(channel)||/^whatsapp$/iu.test(text(attachment.channel)||'')))url=await whatsappMediaUrl(supabase,organizationId,mediaId)
 if(!url&&mediaId&&/^whatsapp$/iu.test(text(attachment.source)||''))url=await whatsappMediaUrl(supabase,organizationId,mediaId)
 let base64=text(attachment.base64||attachment.data,30000000).replace(/^data:[^;]+;base64,/i,'')
 if(base64)return {mime:mime||'application/octet-stream',base64,bytes:Math.floor(base64.length*0.75)}
 if(!url)return {error:'missing_media_url'}
 const headers:Record<string,string>={}
 const token=await metaAccessToken(supabase,organizationId,channel)
 if(token&&/^(whatsapp|facebook|messenger|instagram)$/iu.test(channel))headers.Authorization='Bearer '+token
 if(mediaId&&/graph\\.facebook\\.com/iu.test(url)){
  const {data:integration}=await supabase.from('integrations').select('config,metadata').eq('organization_id',organizationId).eq('provider','whatsapp').eq('connected',true).maybeSingle()
  const config=obj(integration?.config),metadata=obj(integration?.metadata)
  const mediaToken=decryptMetaToken(config.access_token)||decryptMetaToken(metadata.access_token)
  if(mediaToken)headers.Authorization='Bearer '+mediaToken
 }
 let r=await fetchMetaMedia(url,token)
 if(!r.ok)return {error:'media_fetch_'+r.status}
 const buffer=Buffer.from(await r.arrayBuffer())
 const headerMime=(r.headers.get('content-type')||'').split(';')[0].toLowerCase().trim()
 const detected=(headerMime&&headerMime!=='application/octet-stream')?headerMime:(mime&&mime!=='application/octet-stream'?mime:'application/octet-stream')
 return {mime:detected,base64:buffer.toString('base64'),bytes:buffer.byteLength}
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const transientStatus=(status:number)=>status===408||status===425||status===429||status>=500
const retryDelay=(attempt:number)=>Math.min(4000,500*Math.pow(2,attempt)+Math.floor(Math.random()*400))
async function transcribeAudio(apiKey:string,audio:{mime:string;base64:string}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000)
 try{
  const bytes=Buffer.from(audio.base64,'base64')
  const startResponse=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{
   method:'POST',
   headers:{
    'x-goog-api-key':apiKey,
    'X-Goog-Upload-Protocol':'resumable',
    'X-Goog-Upload-Command':'start',
    'X-Goog-Upload-Header-Content-Length':String(bytes.byteLength),
    'X-Goog-Upload-Header-Content-Type':audio.mime,
    'Content-Type':'application/json'
   },
   signal:controller.signal,
   body:JSON.stringify({file:{display_name:'ryan-whatsapp-voice'}})
  })
  if(!startResponse.ok)throw new Error('Gemini file upload start HTTP '+startResponse.status+' '+text(await startResponse.text(),500))
  const uploadUrl=startResponse.headers.get('x-goog-upload-url')
  if(!uploadUrl)throw new Error('Gemini file upload URL missing')
  const uploadResponse=await fetch(uploadUrl,{
   method:'POST',
   headers:{'Content-Length':String(bytes.byteLength),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},
   signal:controller.signal,
   body:bytes
  })
  const fileData=await uploadResponse.json().catch(()=>({}))
  if(!uploadResponse.ok)throw new Error(text(fileData?.error?.message,700)||'Gemini file upload HTTP '+uploadResponse.status)
  const fileUri=text(fileData?.file?.uri,5000)
  if(!fileUri)throw new Error('Gemini file URI missing')
  const interactionResponse=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
   method:'POST',
   headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
   signal:controller.signal,
   body:JSON.stringify({
    model:'gemini-3.5-transcribe',
    input:[{type:'audio',uri:fileUri,mime_type:audio.mime}],
    generation_config:{transcription_config:{language_codes:['ar-EG'],mode:'smart'}}
   })
  })
  const data=await interactionResponse.json().catch(()=>({}))
  if(interactionResponse.ok){
   const out=text(data?.output_text||data?.outputs?.filter?.((item:any)=>item?.type==='text').map?.((item:any)=>item?.text||'').join?.(' '),5000)
   if(out)return out
  }
  // Keep a second documented Gemini path as a runtime fallback. This avoids turning a
  // transient Interactions/API-format issue into Ryan's "I can't hear audio" response.
  const fallbackResponse=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent?key='+encodeURIComponent(apiKey),{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   signal:controller.signal,
   body:JSON.stringify({
    contents:[{
     role:'user',
     parts:[
      {text:'حوّل التسجيل الصوتي إلى نص فقط. اكتب الكلام المنطوق كما قاله العميل بالعربية المصرية، بدون شرح أو تلخيص.'},
      {fileData:{fileUri,mimeType:audio.mime}}
     ]
    }],
    generationConfig:{maxOutputTokens:1200}
   })
  })
  const fallbackData=await fallbackResponse.json().catch(()=>({}))
  if(fallbackResponse.ok){
   const fallbackText=text(fallbackData?.candidates?.[0]?.content?.parts?.map?.((item:any)=>item?.text||'').join?.(''),5000)
   if(fallbackText)return fallbackText
  }
  const interactionError=text(data?.error?.message,500)
  const fallbackError=text(fallbackData?.error?.message,500)
  throw new Error(interactionError||fallbackError||'Gemini transcription returned empty text')
 }catch(error:any){
  throw new Error(error?.name==='AbortError'?'Gemini transcription request timed out':text(error?.message,700)||'Gemini transcription failed')
 }finally{clearTimeout(timeout)}
}

export async function prepareRyanMultimodal(supabase:any,organizationId:string,channel:string,metadata:any,apiKey:string,model:string){
 const attachments=attachmentList(metadata)
 if(!attachments.length)return {currentText:'',parts:[] as GeminiPart[],attachmentSummary:[] as any[],transcript:''}
 const parts:GeminiPart[]=[]
 const summaries:any[]=[]
 let transcript=''
 let transcriptionFailed=false
 for(const attachment of attachments.slice(0,4)){
  const fetched=await fetchAttachment(supabase,organizationId,channel,attachment)
  if(fetched.error){summaries.push({type:'unsupported',reason:fetched.error});continue}
  if(!fetched.mime||!SUPPORTED_INLINE.test(fetched.mime)){summaries.push({type:'unsupported',mime:fetched.mime});continue}
  const fetchedBytes=fetched.bytes??0
  const fetchedMime=fetched.mime??'application/octet-stream'
  const fetchedBase64=fetched.base64??''
  if(fetchedBytes>MAX_INLINE_BYTES){summaries.push({type:'too_large',mime:fetchedMime,bytes:fetchedBytes});continue}
  if(/^audio\//iu.test(fetched.mime)){
   // Audio is transcribed separately; never pass raw WhatsApp audio to Ryan's chat model.
   try{
    const audioText=await transcribeAudio(apiKey,{mime:fetchedMime,base64:fetchedBase64})
    transcript=[transcript,audioText].filter(Boolean).join('\n')
    summaries.push({type:'audio',mime:fetchedMime,transcribed:true})
   }catch(error:any){
    transcriptionFailed=true
    summaries.push({type:'audio',mime:fetchedMime,transcribed:false,error:text(error?.message,300)||'transcription_failed'})
   }
  }else{parts.push({inlineData:{mimeType:fetchedMime,data:fetchedBase64}});summaries.push({type:/^image\//iu.test(fetchedMime)?'image':fetchedMime==='application/pdf'?'pdf':'file',mime:fetchedMime})}
 }
 const attachmentText=summaries.length?'\n[مرفقات العميل: '+summaries.map(x=>x.type+(x.mime?' ('+x.mime+')':'')).join('، ')+']':''
 return {currentText:transcript?transcript+attachmentText:attachmentText,parts,attachmentSummary:summaries,transcript,transcriptionFailed}
}
// Meta CDN auth fix deployed
