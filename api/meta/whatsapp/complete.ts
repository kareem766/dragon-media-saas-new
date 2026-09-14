import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

const GRAPH_VERSION =
  process.env.META_GRAPH_API_VERSION ||
  'v23.0'

function env(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    )
  }

  return value
}

function verifyState(
  state: string,
) {
  const secret =
    env('META_STATE_SECRET')

  const parts =
    state.split('.')

  if (parts.length !== 2) {
    return null
  }

  const [
    encodedPayload,
    signature,
  ] = parts

  const expected =
    createHmac(
      'sha256',
      secret,
    )
      .update(encodedPayload)
      .digest('base64url')

  try {
    const valid =
      timingSafeEqual(
        Buffer.from(
          signature,
          'utf8',
        ),
        Buffer.from(
          expected,
          'utf8',
        ),
      )

    if (!valid) {
      return null
    }
  } catch {
    return null
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          encodedPayload,
          'base64url',
        ).toString('utf8'),
      )

    if (
      !payload ||
      typeof payload !== 'object'
    ) {
      return null
    }

    const issuedAt =
      Number(
        payload.issued_at,
      )

    /*
     * State is intentionally short-lived.
     */
    if (
      !Number.isFinite(
        issuedAt,
      ) ||
      Math.abs(
        Date.now() -
          issuedAt,
      ) >
        15 * 60 * 1000
    ) {
      return null
    }

    if (
      payload.provider !==
      'whatsapp'
    ) {
      return null
    }

    return payload as {
      user_id: string
      organization_id: string
      provider: 'whatsapp'
      nonce: string
      issued_at: number
    }
  } catch {
    return null
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (
    typeof error ===
      'string' &&
    error.trim()
  ) {
    return error.trim()
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim()
  }

  if (
    error &&
    typeof error ===
      'object'
  ) {
    const value =
      error as Record<
        string,
        unknown
      >

    for (
      const key of [
        'message',
        'error',
        'error_description',
        'details',
      ]
    ) {
      const candidate =
        value[key]

      if (
        typeof candidate ===
          'string' &&
        candidate.trim()
      ) {
        return candidate.trim()
      }
    }
  }

  return fallback
}

async function graphGet(
  path: string,
  accessToken: string,
) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}${path}`

  const response =
    await fetch(
      `${url}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`,
    )

  const data =
    await response
      .json()
      .catch(() => null)

  return {
    response,
    data,
  }
}

async function graphPost(
  path: string,
  accessToken: string,
) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}${path}`

  const response =
    await fetch(
      url,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )

  const data =
    await response
      .json()
      .catch(() => null)

  return {
    response,
    data,
  }
}

function extractTargetIds(
  granularScopes: unknown,
) {
  const ids: string[] = []

  if (
    !Array.isArray(
      granularScopes,
    )
  ) {
    return ids
  }

  for (
    const scope of granularScopes
  ) {
    if (
      !scope ||
      typeof scope !==
        'object'
    ) {
      continue
    }

    const current =
      scope as {
        scope?: unknown
        target_ids?: unknown
      }

    if (
      !Array.isArray(
        current.target_ids,
      )
    ) {
      continue
    }

    for (
      const id of current.target_ids
    ) {
      if (
        typeof id ===
          'string' &&
        id.trim() &&
        !ids.includes(
          id.trim(),
        )
      ) {
        ids.push(
          id.trim(),
        )
      }
    }
  }

  return ids
}

async function subscribeWaba(
  wabaId: string,
  accessToken: string,
) {
  const {
    response,
    data,
  } =
    await graphPost(
      `/${encodeURIComponent(wabaId)}/subscribed_apps`,
      accessToken,
    )

  return {
    success:
      response.ok,

    error:
      response.ok
        ? null
        : data?.error?.message ||
          'Unable to subscribe WABA webhook',
  }
}

async function discoverPhone(
  wabaId: string,
  accessToken: string,
  preferredPhoneId:
    | string
    | null,
) {
  if (
    preferredPhoneId
  ) {
    const {
      response,
      data,
    } =
      await graphGet(
        `/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`,
        accessToken,
      )

    if (
      response.ok &&
      Array.isArray(
        data?.data,
      )
    ) {
      const found =
        data.data.find(
          (
            phone: any,
          ) =>
            String(
              phone?.id || '',
            ) ===
            preferredPhoneId,
        )

      if (found) {
        return {
          phoneNumberId:
            String(
              found.id,
            ),

          displayPhoneNumber:
            found.display_phone_number ||
            null,

          verifiedName:
            found.verified_name ||
            null,
        }
      }
    }

    return {
      phoneNumberId:
        preferredPhoneId,

      displayPhoneNumber:
        null,

      verifiedName:
        null,
    }
  }

  const {
    response,
    data,
  } =
    await graphGet(
      `/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`,
      accessToken,
    )

  if (
    !response.ok ||
    !Array.isArray(
      data?.data,
    ) ||
    !data.data.length
  ) {
    return {
      phoneNumberId:
        null,

      displayPhoneNumber:
        null,

      verifiedName:
        null,
    }
  }

  const phone =
    data.data[0]

  return {
    phoneNumberId:
      phone?.id
        ? String(
            phone.id,
          )
        : null,

    displayPhoneNumber:
      phone?.display_phone_number ||
      null,

    verifiedName:
      phone?.verified_name ||
      null,
  }
}

async function discoverWabaFromBusiness(
  accessToken: string,
  businessId: string,
) {
  const endpoints = [
    `/${encodeURIComponent(businessId)}/owned_whatsapp_business_accounts?fields=id,name`,
    `/${encodeURIComponent(businessId)}/client_whatsapp_business_accounts?fields=id,name`,
  ]

  for (
    const endpoint of endpoints
  ) {
    const {
      response,
      data,
    } =
      await graphGet(
        endpoint,
        accessToken,
      )

    if (
      response.ok &&
      Array.isArray(
        data?.data,
      ) &&
      data.data.length
    ) {
      const waba =
        data.data[0]

      if (
        waba?.id
      ) {
        return {
          id: String(
            waba.id,
          ),

          name:
            waba.name ||
            null,
        }
      }
    }
  }

  return null
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader(
    'Cache-Control',
    'no-store',
  )

  if (
    req.method !==
    'POST'
  ) {
    return res.status(405).json({
      error:
        'Method not allowed',
    })
  }

  try {
    const body =
      typeof req.body ===
        'object' &&
      req.body !== null
        ? req.body
        : {}

    const state =
      typeof body.state ===
        'string'
        ? body.state
        : ''

    const code =
      typeof body.code ===
        'string'
        ? body.code
        : ''

    const eventWabaId =
      typeof body.waba_id ===
        'string'
        ? body.waba_id
        : null

    const eventPhoneNumberId =
      typeof body.phone_number_id ===
        'string'
        ? body.phone_number_id
        : null

    const eventBusinessId =
      typeof body.business_id ===
        'string'
        ? body.business_id
        : null

    if (!state) {
      return res.status(400).json({
        error:
          'Missing OAuth state',
      })
    }

    const stateData =
      verifyState(state)

    if (!stateData) {
      return res.status(400).json({
        error:
          'Invalid or expired OAuth state',

        code:
          'META_INVALID_STATE',
      })
    }

    if (!code) {
      return res.status(400).json({
        error:
          'Meta did not return an authorization code',

        code:
          'META_AUTH_CODE_MISSING',
      })
    }

    const appId =
      env('META_APP_ID')

    const appSecret =
      env('META_APP_SECRET')

    /*
     * Embedded Signup authorization-code
     * exchange.
     *
     * IMPORTANT:
     * FB.login() on this page falls back to a full-page
     * redirect when the popup is blocked (common on mobile
     * browsers). When that happens, it implicitly uses the
     * current page URL as redirect_uri. Meta requires the
     * redirect_uri sent during the token exchange to be
     * IDENTICAL to the one used in the OAuth dialog, so we
     * must send it here too — omitting it causes:
     * "Error validating verification code. Please make sure
     * your redirect_uri is identical to the one you used in
     * the OAuth dialog request".
     *
     * We derive it from META_REDIRECT_URI (which points at
     * /api/meta/oauth/callback) by swapping the path to this
     * page's own path, so there is a single source of truth
     * for the app's base URL.
     */
    const redirectUri =
      env('META_REDIRECT_URI').replace(
        /\/api\/meta\/oauth\/callback\/?$/,
        '/api/meta/whatsapp/signup',
      )

    const exchangeParams =
      new URLSearchParams({
        client_id:
          appId,

        client_secret:
          appSecret,

        redirect_uri:
          redirectUri,

        code,
      })

    const exchangeResponse =
      await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${exchangeParams.toString()}`,
      )

    const exchangeData =
      await exchangeResponse
        .json()
        .catch(() => null)

    if (
      !exchangeResponse.ok ||
      !exchangeData?.access_token
    ) {
      console.error(
        'WhatsApp Embedded Signup token exchange failed:',
        {
          status:
            exchangeResponse.status,

          error:
            exchangeData?.error,
        },
      )

      return res.status(502).json({
        error:
          exchangeData?.error?.message ||
          'Meta authorization code exchange failed',

        code:
          'META_TOKEN_EXCHANGE_FAILED',
      })
    }

    const accessToken =
      String(
        exchangeData.access_token,
      )

    /*
     * Validate token and obtain Meta user.
     */
    const debugParams =
      new URLSearchParams({
        input_token:
          accessToken,

        access_token:
          `${appId}|${appSecret}`,
      })

    const debugResponse =
      await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?${debugParams.toString()}`,
      )

    const debugData =
      await debugResponse
        .json()
        .catch(() => null)

    if (
      !debugResponse.ok ||
      !debugData?.data?.is_valid
    ) {
      return res.status(502).json({
        error:
          'Meta returned an invalid WhatsApp access token.',

        code:
          'META_TOKEN_INVALID',
      })
    }

    const metaUserId =
      debugData.data.user_id
        ? String(
            debugData.data.user_id,
          )
        : null

    if (!metaUserId) {
      return res.status(502).json({
        error:
          'Meta user ID was not returned.',

        code:
          'META_USER_ID_MISSING',
      })
    }

    /*
     * Embedded Signup can provide the WABA directly.
     * If not, use granular scope target IDs and
     * business discovery.
     */
    const granularScopes =
      debugData.data.granular_scopes

    const targetIds =
      extractTargetIds(
        granularScopes,
      )

    let businessId =
      eventBusinessId

    let wabaId =
      eventWabaId

    let phoneNumberId =
      eventPhoneNumberId

    let displayPhoneNumber:
      | string
      | null = null

    let verifiedName:
      | string
      | null = null

    /*
     * Prefer a target associated with
     * whatsapp_business_management.
     */
    if (
      !wabaId &&
      Array.isArray(
        granularScopes,
      )
    ) {
      for (
        const scope of granularScopes
      ) {
        if (
          !scope ||
          typeof scope !==
            'object'
        ) {
          continue
        }

        const current =
          scope as {
            scope?: unknown
            target_ids?: unknown
          }

        if (
          current.scope !==
          'whatsapp_business_management'
        ) {
          continue
        }

        if (
          Array.isArray(
            current.target_ids,
          )
        ) {
          const candidate =
            current.target_ids.find(
              (
                value: unknown,
              ) =>
                typeof value ===
                  'string' &&
                value.trim(),
            )

          if (
