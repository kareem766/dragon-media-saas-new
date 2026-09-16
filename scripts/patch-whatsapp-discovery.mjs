import fs from 'node:fs'

const path = 'api/meta/oauth/callback.ts'
let source = fs.readFileSync(path, 'utf8')

const marker = "  /*\n   * --------------------------------------------------\n   * 2. Discover business accounts from /me/businesses.\n   * --------------------------------------------------\n   */"

const block = String.raw`  /*
   * --------------------------------------------------
   * Embedded Signup direct WABA discovery fallback.
   *
   * Newer Meta WhatsApp flows may return the required
   * WhatsApp permissions in token.scopes without
   * exposing granular_scopes.target_ids. In that case
   * /{user-id}/whatsapp_business_accounts can still
   * expose the WABA granted by Embedded Signup.
   * --------------------------------------------------
   */
  if (!wabaId) {
    const directWabaCandidates = new Set<string>()

    const collectDirectWabas = (data: any) => {
      if (!Array.isArray(data?.data)) return
      for (const item of data.data) {
        if (item?.id) directWabaCandidates.add(String(item.id))
      }
    }

    for (const endpoint of [
      `/${encodeURIComponent(metaUserId)}/whatsapp_business_accounts?fields=id,name`,
      '/me/whatsapp_business_accounts?fields=id,name',
    ]) {
      try {
        const { response, data } = await graphRequest(endpoint, accessToken)
        if (response.ok) {
          collectDirectWabas(data)
        } else {
          console.warn('WhatsApp direct WABA discovery failed:', {
            endpoint,
            status: response.status,
            error: data?.error,
          })
        }
      } catch (error) {
        console.warn('WhatsApp direct WABA discovery error:', { endpoint, error })
      }
    }

    for (const candidateId of directWabaCandidates) {
      try {
        const { response, data } = await graphRequest(
          `/${encodeURIComponent(candidateId)}/phone_numbers?fields=id,display_phone_number,verified_name`,
          accessToken,
        )

        if (response.ok && Array.isArray(data?.data) && data.data.length > 0) {
          const phone = data.data[0]
          wabaId = candidateId
          phoneNumberId = phone?.id ? String(phone.id) : null
          displayPhoneNumber = typeof phone?.display_phone_number === 'string' ? phone.display_phone_number : null
          verifiedName = typeof phone?.verified_name === 'string' ? phone.verified_name : null
          console.info('WhatsApp phone discovered through direct WABA fallback:', {
            wabaId,
            phoneNumberId,
          })
          break
        }
      } catch (error) {
        console.warn('WhatsApp direct WABA phone discovery error:', {
          candidateId,
          error,
        })
      }
    }
  }

`

if (!source.includes("Embedded Signup direct WABA discovery fallback.")) {
  const index = source.indexOf(marker)
  if (index < 0) throw new Error('WhatsApp discovery insertion marker not found')
  source = source.slice(0, index) + block + source.slice(index)
}

fs.writeFileSync(path, source)
console.log('WhatsApp direct WABA discovery fallback applied')
