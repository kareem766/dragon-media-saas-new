import fs from 'node:fs'

const path = 'api/meta/oauth/callback.ts'
const source = fs.readFileSync(path, 'utf8')
const marker = "  /*\n   * --------------------------------------------------\n   * 2. Discover business accounts from /me/businesses.\n   * --------------------------------------------------\n   */"

const block = String.raw`  /*
   * --------------------------------------------------
   * Robust Embedded Signup WABA discovery fallback.
   *
   * Do not query /{user-id}/whatsapp_business_accounts:
   * that edge is not supported by the Graph API version
   * used by this app. Instead discover every business the
   * token can see, then inspect both supported WABA edges
   * and finally /{waba-id}/phone_numbers.
   * --------------------------------------------------
   */
  if (!wabaId) {
    const businessCandidates = new Set<string>()
    const wabaCandidates = new Set<string>()

    try {
      const { response, data } = await graphRequest(
        '/me/businesses?fields=id,name&limit=100',
        accessToken,
      )

      if (response.ok && Array.isArray(data?.data)) {
        for (const business of data.data) {
          if (business?.id) businessCandidates.add(String(business.id))
        }
      } else {
        console.warn('WhatsApp business discovery failed:', {
          status: response.status,
          error: data?.error,
        })
      }
    } catch (error) {
      console.warn('WhatsApp business discovery error:', error)
    }

    for (const businessId of businessCandidates) {
      for (const edge of [
        'owned_whatsapp_business_accounts',
        'client_whatsapp_business_accounts',
      ]) {
        try {
          const { response, data } = await graphRequest(
            '/' + encodeURIComponent(businessId) + '/' + edge + '?fields=id,name&limit=100',
            accessToken,
          )

          if (response.ok && Array.isArray(data?.data)) {
            for (const waba of data.data) {
              if (waba?.id) wabaCandidates.add(String(waba.id))
            }
          }
        } catch (error) {
          console.warn('WhatsApp WABA edge discovery error:', {
            businessId,
            edge,
            error,
          })
        }
      }
    }

    for (const candidateId of wabaCandidates) {
      try {
        const { response, data } = await graphRequest(
          '/' + encodeURIComponent(candidateId) + '/phone_numbers?fields=id,display_phone_number,verified_name&limit=100',
          accessToken,
        )

        if (response.ok && Array.isArray(data?.data) && data.data.length > 0) {
          const phone = data.data[0]
          wabaId = candidateId
          phoneNumberId = phone?.id ? String(phone.id) : null
          displayPhoneNumber = typeof phone?.display_phone_number === 'string' ? phone.display_phone_number : null
          verifiedName = typeof phone?.verified_name === 'string' ? phone.verified_name : null
          console.info('WhatsApp phone discovered through robust WABA fallback:', {
            businessCandidates: Array.from(businessCandidates),
            wabaId,
            phoneNumberId,
          })
          break
        }
      } catch (error) {
        console.warn('WhatsApp phone discovery error:', {
          candidateId,
          error,
        })
      }
    }
  }

`

if (!source.includes('Robust Embedded Signup WABA discovery fallback.')) {
  const index = source.indexOf(marker)
  if (index < 0) throw new Error('WhatsApp discovery insertion marker not found')
  const patched = source.slice(0, index) + block + source.slice(index)
  fs.writeFileSync(path, patched)
  console.log('WhatsApp robust WABA discovery fallback applied')
} else {
  console.log('WhatsApp robust WABA discovery fallback already present')
}
