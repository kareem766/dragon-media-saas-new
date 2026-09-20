import { readFileSync, writeFileSync } from 'node:fs'

const path = 'api/admin/ryan-inbox.ts'
const source = readFileSync(path, 'utf8')
const marker = '   const effectiveNeedsHuman=needsHuman'
const injection = `   // Never let model text claim an action completed when the application did not complete it.\n   if(action && ['update_customer','follow_up','schedule_appointment','create_automation'].includes(action) && !actionResult?.success){\n    const actionFailureReplies:Record<string,string>={\n     update_customer:'تمام، لسه ماقدرتش أعدّل بيانات حضرتك بشكل مؤكد. ممكن نكمل من هنا؟',\n     follow_up:'تمام، لسه ماقدرتش أفعّل المتابعة بشكل مؤكد. ممكن نحددها مرة تانية؟',\n     schedule_appointment:'تمام، الموعد لسه ما اتحجزش بشكل مؤكد. قولي التاريخ والساعة المناسبين وهنحاول نحجزهم.',\n     create_automation:'تمام، لسه ماقدرتش أفعّل الأتمتة بشكل مؤكد. ممكن نراجع المطلوب ونحاول تاني.'\n    }\n    reply=actionFailureReplies[action]||'تمام، العملية لسه ما اكتملتش بشكل مؤكد. خلينا نحاول تاني.'\n   }\n${marker}`
if(source.includes('Never let model text claim an action completed')) process.exit(0)
if(!source.includes(marker)) throw new Error('Ryan action safety marker not found')
writeFileSync(path, source.replace(marker, injection), 'utf8')
