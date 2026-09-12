import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'node:crypto'

const META_AUTH_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v23.0'

type MetaProvider =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'

function env(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    )
  }

  return value
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signState(
  payload: string,
  secret: string
) {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
}

function getProvider(
  value: unknown
): MetaProvider {
  if (
    value === 'facebook' ||
    value === 'instagram' ||
    value === 'whatsapp'
  ) {
    return value
  }

  return 'whatsapp'
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader(
    'Cache-Control',
    'no-store'
  )

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({
        error: 'Method not allowed',
      })
  }

  try {
    const authorization =
      req.headers.authorization || ''

    const accessToken =
      authorization.startsWith('Bearer ')
        ? authorization.slice(
            'Bearer '.length
          )
        : ''

    if (!accessToken) {
      return res
        .status(401)
        .json({
          error:
            'Authentication required',
        })
    }

    const provider = getProvider(
      req.query.provider
    )

    const supabase =
      createClient(
        env('VITE_SUPABASE_URL'),
        env('VITE_SUPABASE_ANON_KEY'),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )

    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser(
        accessToken
      )

    if (
      authError ||
      !authData.user
    ) {
      return res
        .status(401)
        .json({
          error:
            'Invalid authentication token',
        })
    }

    const {
      data: membership,
      error: membershipError,
    } =
      await supabase
        .from('users')
        .select(
          'organization_id'
        )
        .eq(
          'id',
          authData.user.id
        )
        .maybeSingle()

    if (
      membershipError ||
      !membership?.organization_id
    ) {
      return res
        .status(403)
        .json({
          error:
            'Organization membership not found',
        })
    }

    const redirectUri =
      env('META_REDIRECT_URI')

    const appId =
      env('META_APP_ID')

    const configId =
      env('META_LOGIN_CONFIG_ID')

    const stateSecret =
      env('META_STATE_SECRET')

    /*
     * The provider is included inside the
     * signed state so it cannot be changed
     * by the browser during the OAuth flow.
     */
    const payload =
      JSON.stringify({
        user_id:
          authData.user.id,

        organization_id:
          membership.organization_id,

        provider,

        nonce:
          randomBytes(16).toString(
            'hex'
          ),

        issued_at:
          Date.now(),
      })

    const encodedPayload =
      base64Url(payload)

    const signature =
      signState(
        encodedPayload,
        stateSecret
      )

    const state =
      `${encodedPayload}.${signature}`

    const params =
      new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        config_id: configId,
      })

    const authUrl =
      `https://www.facebook.com/${META_AUTH_VERSION}/dialog/oauth?` +
      params.toString()

    return res
      .status(200)
      .json({
        auth_url: authUrl,
        provider,
      })
  } catch (error) {
    console.error(
      'Meta OAuth start error:',
      error
    )

    return res
      .status(500)
      .json({
        error:
          'Unable to start Meta connection',
      })
  }
}
