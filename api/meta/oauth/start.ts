import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'node:crypto'

type MetaProvider = 'whatsapp' | 'facebook' | 'instagram'

const META_GRAPH_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v23.0'

function env(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signState(payload: string, secret: string) {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
}

function getProvider(value: unknown): MetaProvider {
  if (
    value === 'facebook' ||
    value === 'instagram' ||
    value === 'whatsapp'
  ) {
    return value
  }

  return 'whatsapp'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>

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
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  try {
    const authorization =
      req.headers.authorization || ''

    const accessToken =
      authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : ''

    if (!accessToken) {
      return res.status(401).json({
        error: 'Authentication required',
      })
    }

    const provider = getProvider(
      req.query.provider,
    )

    const supabase = createClient(
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
      await supabase.auth.getUser(
        accessToken,
      )

    if (authError || !authData.user) {
      return res.status(401).json({
        error: 'Invalid authentication token',
      })
    }

    const adminSupabase = createClient(
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
        .select('organization_id')
        .eq('id', authData.user.id)
        .maybeSingle()

    if (membershipError) {
      console.error(
        'Meta OAuth membership lookup error:',
        membershipError,
      )

      return res.status(500).json({
        error:
          'Unable to verify organization membership',
        code:
          'META_MEMBERSHIP_LOOKUP_FAILED',
      })
    }

    if (!membership?.organization_id) {
      return res.status(403).json({
        error:
          'Organization membership not found',
      })
    }

    const appId = env('META_APP_ID')
    const stateSecret = env('META_STATE_SECRET')

    const configId =
      process.env.META_WHATSAPP_EMBEDDED_CONFIG_ID

    if (
      provider === 'whatsapp' &&
      !configId
    ) {
      return res.status(500).json({
        error:
          'WhatsApp Embedded Signup is not configured.',
        code:
          'META_WHATSAPP_CONFIG_MISSING',
      })
    }

    const redirectUri =
      env('META_REDIRECT_URI')

    const statePayload = JSON.stringify({
      user_id: authData.user.id,
      organization_id:
        membership.organization_id,
      provider,
      nonce: randomBytes(16).toString('hex'),
      issued_at: Date.now(),
    })

    const encodedPayload =
      base64Url(statePayload)

    const signature = signState(
      encodedPayload,
      stateSecret,
    )

    const state =
      `${encodedPayload}.${signature}`

    /*
     * WhatsApp:
     * The actual Embedded Signup UI is opened
     * through the Facebook JS SDK from Settings.
     *
     * We return the information required by the
     * frontend instead of forcing the old redirect
     * OAuth flow.
     */
    if (provider === 'whatsapp') {
      return res.status(200).json({
        provider,
        mode: 'embedded_signup',
        app_id: appId,
        config_id: configId,
        state,
        complete_url:
          `${redirectUri.replace(/\/api\/meta\/oauth\/callback\/?$/, '')}/api/meta/whatsapp/complete`,
        graph_version:
          META_GRAPH_VERSION,
      })
    }

    /*
     * Facebook / Instagram keep the existing
     * Login for Business redirect flow.
     */
    const configEnv =
      provider === 'facebook'
        ? 'META_FACEBOOK_LOGIN_CONFIG_ID'
        : 'META_INSTAGRAM_LOGIN_CONFIG_ID'

    const providerConfig =
      process.env[configEnv]

    if (!providerConfig) {
      return res.status(500).json({
        error:
          `Meta ${provider} connection is not configured.`,
        code:
          'META_PROVIDER_CONFIG_MISSING',
      })
    }

    const params =
      new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        config_id: providerConfig,
      })

    const authUrl =
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`

    return res.status(200).json({
      auth_url: authUrl,
      provider,
      config_id: providerConfig,
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

    return res.status(500).json({
      error: message,
      code:
        'META_OAUTH_START_FAILED',
    })
  }
}
