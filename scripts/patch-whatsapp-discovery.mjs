import fs from 'node:fs'

const path = 'api/meta/oauth/callback.ts'
const source = fs.readFileSync(path, 'utf8')
const start = source.indexOf('async function discoverWhatsAppData(')
const end = source.indexOf('\nexport default async function handler(', start)

if (start < 0 || end < 0) {
  throw new Error('WhatsApp discovery function boundaries not found')
}

const replacement = String.raw`async function discoverWhatsAppData(
  accessToken: string,
  metaUserId: string
): Promise<WhatsAppDiscoveryResult> {
  let businessId: string | null = null
  let wabaId: string | null = null
  let phoneNumberId: string | null = null
  let displayPhoneNumber: string | null = null
  let verifiedName: string | null = null
  let webhookSubscribed = false

  const businessIds = new Set<string>()
  const candidateWabaIds = new Set<string>()

  const addBusiness = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) businessIds.add(value.trim())
  }

  const addWaba = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) candidateWabaIds.add(value.trim())
  }

  try {
    const appId = getEnv('META_APP_ID')
    const appSecret = getEnv('META_APP_SECRET')
    const appAccessToken = String(appId) + '|' + String(appSecret)
    const debugParams = new URLSearchParams({ input_token: accessToken, access_token: appAccessToken })
    const debugResponse = await fetch('https://graph.facebook.com/' + META_AUTH_VERSION + '/debug_token?' + debugParams.toString())
    const debugData = await debugResponse.json().catch(() => null)
    const debugToken = debugData?.data
    const granularScopes = debugToken?.granular_scopes
    const scopes = Array.isArray(debugToken?.scopes) ? debugToken.scopes : []
    const hasManagement = scopes.includes('whatsapp_business_management') || (Array.isArray(granularScopes) && granularScopes.some((scope: any) => scope?.scope === 'whatsapp_business_management'))
    const hasMessaging = scopes.includes('whatsapp_business_messaging') || (Array.isArray(granularScopes) && granularScopes.some((scope: any) => scope?.scope === 'whatsapp_business_messaging'))
    const targetIds = extractWhatsAppTargetIds(granularScopes)
    for (const id of targetIds) addWaba(id)
    console.info('WhatsApp Meta token inspected:', { is_valid: debugToken?.is_valid, app_id: debugToken?.app_id, has_whatsapp_management: hasManagement, has_whatsapp_messaging: hasMessaging, whatsapp_target_count: targetIds.length })
  } catch (error) {
    console.warn('WhatsApp token inspection failed:', error)
  }

  let businesses: any[] = []
  try {
    const rich = await graphRequest('/' + encodeURIComponent(metaUserId) + '/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}', accessToken)
    if (rich.response.ok && Array.isArray(rich.data?.data)) {
      businesses = rich.data.data
    } else {
      const fallback = await graphRequest('/' + encodeURIComponent(metaUserId) + '/businesses?fields=id,name', accessToken)
      if (fallback.response.ok && Array.isArray(fallback.data?.data)) businesses = fallback.data.data
      else console.warn('WhatsApp business discovery failed:', { rich_status: rich.response.status, rich_error: rich.data?.error, fallback_status: fallback.response.status, fallback_error: fallback.data?.error })
    }
  } catch (error) {
    console.warn('WhatsApp business discovery error:', error)
  }

  for (const business of businesses) {
    addBusiness(business?.id)
    for (const waba of Array.isArray(business?.owned_whatsapp_business_accounts?.data) ? business.owned_whatsapp_business_accounts.data : []) addWaba(waba?.id)
    for (const waba of Array.isArray(business?.client_whatsapp_business_accounts?.data) ? business.client_whatsapp_business_accounts.data : []) addWaba(waba?.id)
  }

  for (const currentBusinessId of businessIds) {
    for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
      try {
        const { response, data } = await graphRequest('/' + encodeURIComponent(currentBusinessId) + '/' + edge + '?fields=id,name', accessToken)
        if (response.ok && Array.isArray(data?.data)) for (const waba of data.data) addWaba(waba?.id)
        else console.warn('WhatsApp WABA edge discovery failed:', { businessId: currentBusinessId, edge, status: response.status, error: data?.error })
      } catch (error) {
        console.warn('WhatsApp WABA edge discovery error:', { businessId: currentBusinessId, edge, error })
      }
    }
  }

  for (const candidateId of candidateWabaIds) {
    try {
      const { response, data } = await graphRequest('/' + encodeURIComponent(candidateId) + '?fields=id,name,owner_business_info', accessToken)
      if (!response.ok || !data?.id) continue
      wabaId = String(data.id)
      if (data.owner_business_info?.id) businessId = String(data.owner_business_info.id)
      if (!businessId && businessIds.size) businessId = Array.from(businessIds)[0]
      break
    } catch (error) {
      console.warn('WhatsApp WABA details lookup failed:', { candidateId, error })
    }
  }

  if (wabaId) {
    try {
      const { response, data } = await graphRequest('/' + encodeURIComponent(wabaId) + '/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,platform_type', accessToken)
      if (response.ok && Array.isArray(data?.data) && data.data.length) {
        const phone = data.data[0]
        phoneNumberId = phone?.id ? String(phone.id) : null
        displayPhoneNumber = typeof phone?.display_phone_number === 'string' ? phone.display_phone_number : null
        verifiedName = typeof phone?.verified_name === 'string' ? phone.verified_name : null
      } else {
        console.warn('WhatsApp phone discovery failed:', { wabaId, status: response.status, error: data?.error })
      }
    } catch (error) {
      console.warn('WhatsApp phone discovery error:', error)
    }
  }

  if (wabaId) webhookSubscribed = await subscribeWhatsAppBusinessAccount(wabaId, accessToken)

  console.info('WhatsApp discovery result:', { businessId, wabaId, phoneNumberId, webhookSubscribed, candidate_waba_count: candidateWabaIds.size, business_count: businessIds.size })

  return { businessId, wabaId, phoneNumberId, displayPhoneNumber, verifiedName, webhookSubscribed }
}`

let patched = source.slice(0, start) + replacement + source.slice(end)
patched = patched.replace(
  ".select(\n          'id, metadata'\n        )",
  ".select(\n          'id, metadata, business_id, waba_id, phone_number_id, display_phone_number, verified_name'\n        )"
)

const marker = '    const connectionMetadata = {'
const mergeBlock = `    if (provider === 'whatsapp') {
      businessId = businessId || existingConnection?.business_id || null
      wabaId = wabaId || existingConnection?.waba_id || existingConnectionMetadata.waba_id || null
      phoneNumberId = phoneNumberId || existingConnection?.phone_number_id || existingConnectionMetadata.phone_number_id || null
      displayPhoneNumber = displayPhoneNumber || existingConnection?.display_phone_number || existingConnectionMetadata.display_phone_number || null
      verifiedName = verifiedName || existingConnection?.verified_name || existingConnectionMetadata.verified_name || null
    }

`

if (!patched.includes(mergeBlock)) {
  const index = patched.indexOf(marker)
  if (index < 0) throw new Error('connectionMetadata marker not found')
  patched = patched.slice(0, index) + mergeBlock + patched.slice(index)
}

fs.writeFileSync(path, patched)
console.log('WhatsApp discovery patch applied')
