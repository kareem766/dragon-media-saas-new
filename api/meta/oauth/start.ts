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
      `Missing environment variable: ${name}`,
    )
  }

  return value
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signState(
  payload: string,
  secret: string,
) {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
}

function getProvider(
  value: unknown,
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

function getProviderConfigEnv(
  provider: MetaProvider,
) {
  switch (provider) {
    case 'facebook':
      return 'META_FACEBOOK_LOGIN_CONFIG_ID'

    case 'instagram':
      return 'META_INSTAGRAM_LOGIN_CONFIG_ID'

    case 'whatsapp':
      // WhatsApp must use a dedicated Embedded Signup v4 configuration.
      return 'META_WHATSAPP_EMBEDDED_CONFIG_ID'
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (
    typeof error === 'string' &&
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
    typeof error === 'object'
  ) {
    const value =
      error as Record<string, unknown>

    for (const key of [
      'message',
      'error',
      'error_description',
      'details',
    ]) {
      const candidate = value[key]

      if (
        typeof candidate === 'string' &&
        candidate.trim()
      ) {
        return candidate.trim()
      }
    }
  }

  return fallback
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader(
    'Cache-Control',
    'no-store',
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
            'Bearer '.length,
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

    const provider =
      getProvider(
        req.query.provider,
      )

    const authSupabase =
      createClient(
        env('VITE_SUPABASE_URL'),
        env('VITE_SUPABASE_ANON_KEY'),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )

    const {
      data: authData,
      error: authError,
    } =
      await authSupabase.auth.getUser(
        accessToken,
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

    const adminSupabase =
      createClient(
        env('VITE_SUPABASE_URL'),
        env('SUPABASE_SECRET_KEY'),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )

    const {
      data: membership,
      error: membershipError,
    } =
      await adminSupabase
        .from('users')
        .select(
          'organization_id',
        )
        .eq(
          'id',
          authData.user.id,
        )
        .maybeSingle()

    if (
      membershipError
    ) {
      console.error(
        'Meta OAuth membership lookup error:',
        membershipError,
      )

      return res
        .status(500)
        .json({
          error:
            'Unable to verify organization membership',
          code:
            'META_MEMBERSHIP_LOOKUP_FAILED',
        })
    }

    if (
      !membership?.organization_id
    ) {
      return res
        .status(403)
        .json({
          error:
            'Organization membership not found',
        })
    }

    const configEnv =
      getProviderConfigEnv(
        provider,
      )

    const configId =
      process.env[configEnv]

    if (!configId) {
      return res
        .status(500)
        .json({
          error:
            `Meta ${provider} connection is not configured yet. Missing ${configEnv}.`,
          code:
            'META_PROVIDER_CONFIG_MISSING',
          provider,
        })
    }

    const redirectUri =
      env('META_REDIRECT_URI')

    const appId =
      env('META_APP_ID')

    const stateSecret =
      env('META_STATE_SECRET')

    const payload =
      JSON.stringify({
        user_id:
          authData.user.id,

        organization_id:
          membership.organization_id,

        provider,

        nonce:
          randomBytes(16).toString(
            'hex',
          ),

        issued_at:
          Date.now(),
      })

    const encodedPayload =
      base64Url(payload)

    const signature =
      signState(
        encodedPayload,
        stateSecret,
      )

    const state =
      `${encodedPayload}.${signature}`

    /*
     * WhatsApp uses a dedicated Embedded Signup v4
     * Login for Business configuration.
     *
     * The v4 configuration controls the WhatsApp
     * products, assets and permissions. We intentionally
     * do not send a scope list from the application.
     *
     * Facebook and Instagram keep their existing
     * Login for Business configurations.
     */
    const params =
      new URLSearchParams({
        client_id:
          appId,

        redirect_uri:
          redirectUri,

        response_type:
          'code',

        state,

        config_id:
          configId,
      })

    const authUrl =
      `https://www.facebook.com/${META_AUTH_VERSION}/dialog/oauth?` +
      params.toString()

    return res
      .status(200)
      .json({
        auth_url:
          authUrl,

        provider,

        config_id:
          configId,
      })
  } catch (error) {
    const message =
      getErrorMessage(
        error,
        'Unable to start Meta connection',
      )

    console.error(
      'Meta OAuth start error:',
      error,
    )

    return res
      .status(500)
      .json({
        error: message,
        code:
          'META_OAUTH_START_FAILED',
      })
  }
}
