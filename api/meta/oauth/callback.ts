import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const META_AUTH_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v23.0'

function getEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function verifyState(state: string, secret: string) {
  const separator = state.lastIndexOf('.')

  if (separator <= 0) {
    return null
  }

  const payload = state.slice(0, separator)
  const signature = state.slice(separator + 1)

  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')

  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(
      providedBuffer,
      expectedBuffer
    )
  ) {
    return null
  }

  try {
    const decoded = Buffer.from(
      payload,
      'base64url'
    ).toString('utf8')

    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function redirectToSettings(
  res: VercelResponse,
  status: 'connected' | 'error'
) {
  const redirectUri =
    process.env.META_REDIRECT_URI

  if (!redirectUri) {
    return false
  }

  try {
    const origin =
      new URL(redirectUri).origin

    const url =
      `${origin}/#/settings?meta=${status}`

    res.redirect(303, url)

    return true
  } catch {
    return false
  }
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
      .send('Method not allowed')
  }

  try {
    const code =
      typeof req.query.code === 'string'
        ? req.query.code
        : null

    const state =
      typeof req.query.state === 'string'
        ? req.query.state
        : null

    const metaError =
      typeof req.query.error === 'string'
        ? req.query.error
        : null

    const errorDescription =
      typeof req.query.error_description ===
      'string'
        ? req.query.error_description
        : null

    if (metaError) {
      console.error(
        'Meta OAuth denied:',
        {
          error: metaError,
          errorDescription,
        }
      )

      if (
        redirectToSettings(
          res,
          'error'
        )
      ) {
        return
      }

      return res
        .status(400)
        .send(
          'لم يتم إكمال ربط Meta. يمكنك العودة إلى Dragon Media والمحاولة مرة أخرى.'
        )
    }

    if (!code || !state) {
      return res
        .status(400)
        .send(
          'طلب Meta غير مكتمل.'
        )
    }

    const stateData =
      verifyState(
        state,
        getEnv(
          'META_STATE_SECRET'
        )
      )

    if (!stateData) {
      return res
        .status(400)
        .send(
          'رابط الربط غير صالح أو انتهت صلاحيته.'
        )
    }

    if (
      !stateData.organization_id ||
      !stateData.user_id ||
      !stateData.issued_at
    ) {
      return res
        .status(400)
        .send(
          'بيانات جلسة الربط غير صالحة.'
        )
    }

    const stateAge =
      Date.now() -
      Number(
        stateData.issued_at
      )

    if (
      stateAge < 0 ||
      stateAge >
        10 * 60 * 1000
    ) {
      return res
        .status(400)
        .send(
          'انتهت صلاحية جلسة ربط Meta. ابدأ عملية الربط مرة أخرى.'
        )
    }

    const appId =
      getEnv('META_APP_ID')

    const appSecret =
      getEnv('META_APP_SECRET')

    const redirectUri =
      getEnv('META_REDIRECT_URI')

    const supabaseUrl =
      getEnv('VITE_SUPABASE_URL')

    const serviceKey =
      getEnv(
        'SUPABASE_SERVICE_KEY'
      )

    /*
     * Exchange Meta authorization code
     * for an access token server-side.
     */
    const tokenParams =
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      })

    const tokenResponse =
      await fetch(
        `https://graph.facebook.com/${META_AUTH_VERSION}/oauth/access_token?${tokenParams.toString()}`
      )

    const tokenData =
      await tokenResponse
        .json()
        .catch(() => null)

    if (
      !tokenResponse.ok ||
      !tokenData?.access_token
    ) {
      console.error(
        'Meta OAuth token exchange failed:',
        {
          status:
            tokenResponse.status,
          error:
            tokenData?.error,
        }
      )

      if (
        redirectToSettings(
          res,
          'error'
        )
      ) {
        return
      }

      return res
        .status(502)
        .send(
          'تعذر إكمال الاتصال مع Meta. حاول مرة أخرى.'
        )
    }

    const accessToken =
      tokenData.access_token as string

    /*
     * IMPORTANT:
     * Never expose the Meta access token
     * to the browser.
     */
    const admin =
      createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      )

    /*
     * Validate organization.
     */
    const {
      data: organization,
      error: organizationError,
    } = await admin
      .from('organizations')
      .select('id')
      .eq(
        'id',
        stateData.organization_id
      )
      .maybeSingle()

    if (
      organizationError ||
      !organization
    ) {
      console.error(
        'Meta OAuth organization validation failed:',
        organizationError
      )

      return res
        .status(403)
        .send(
          'تعذر التحقق من الشركة المرتبطة بعملية الربط.'
        )
    }

    /*
     * Validate user membership.
     */
    const {
      data: membership,
      error: membershipError,
    } = await admin
      .from('users')
      .select(
        'organization_id'
      )
      .eq(
        'id',
        stateData.user_id
      )
      .eq(
        'organization_id',
        stateData.organization_id
      )
      .maybeSingle()

    if (
      membershipError ||
      !membership
    ) {
      console.error(
        'Meta OAuth membership validation failed:',
        membershipError
      )

      return res
        .status(403)
        .send(
          'لم يعد المستخدم مصرحًا بربط Meta بهذه الشركة.'
        )
    }

    /*
     * Validate the Meta token.
     * Only non-sensitive Meta identity
     * information is stored.
     */
    const meResponse =
      await fetch(
        `https://graph.facebook.com/${META_AUTH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(
          accessToken
        )}`
      )

    const meData =
      await meResponse
        .json()
        .catch(() => null)

    if (
      !meResponse.ok ||
      !meData?.id
    ) {
      console.error(
        'Meta identity validation failed:',
        {
          status:
            meResponse.status,
          error:
            meData?.error,
        }
      )

      if (
        redirectToSettings(
          res,
          'error'
        )
      ) {
        return
      }

      return res
        .status(502)
        .send(
          'تم رفض صلاحية Meta أو تعذر التحقق منها.'
        )
    }

    const now =
      new Date().toISOString()

    const metadata = {
      meta_user_id:
        String(meData.id),

      meta_user_name:
        typeof meData.name ===
        'string'
          ? meData.name
          : null,

      connection_type:
        'meta_login_business',

      last_oauth_verified_at:
        now,
    }

    /*
     * Find existing WhatsApp integration.
     */
    const {
      data: existingIntegration,
      error: existingError,
    } = await admin
      .from('integrations')
      .select(
        'id, metadata, connected_at'
      )
      .eq(
        'organization_id',
        stateData.organization_id
      )
      .eq(
        'provider',
        'whatsapp'
      )
      .maybeSingle()

    if (existingError) {
      console.error(
        'Meta OAuth integration lookup failed:',
        existingError
      )

      return res
        .status(500)
        .send(
          'تعذر تحديث حالة تكامل WhatsApp.'
        )
    }

    const existingMetadata =
      existingIntegration?.metadata &&
      typeof existingIntegration.metadata ===
        'object'
        ? existingIntegration.metadata
        : {}

    const integrationPayload = {
      organization_id:
        stateData.organization_id,

      provider: 'whatsapp',

      connected: true,

      status: 'connected',

      metadata: {
        ...existingMetadata,
        ...metadata,
      },

      connected_at:
        existingIntegration?.connected_at ||
        now,

      last_verified_at:
        now,

      error_message:
        null,

      updated_at:
        now,
    }

    let integrationResult

    if (existingIntegration?.id) {
      integrationResult =
        await admin
          .from('integrations')
          .update(
            integrationPayload
          )
          .eq(
            'id',
            existingIntegration.id
          )
    } else {
      integrationResult =
        await admin
          .from('integrations')
          .insert(
            integrationPayload
          )
    }

    if (integrationResult.error) {
      console.error(
        'Meta OAuth integration persistence failed:',
        integrationResult.error
      )

      return res
        .status(500)
        .send(
          'تم التحقق من Meta لكن تعذر حفظ حالة التكامل.'
        )
    }

    /*
     * Do not return the access token.
     * Return the user to Dragon Media.
     */
    if (
      redirectToSettings(
        res,
        'connected'
      )
    ) {
      return
    }

    return res
      .status(200)
      .send(`
        <!doctype html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <title>تم الاتصال</title>
          </head>

          <body>
            <main
              style="
                max-width:520px;
                margin:80px auto;
                padding:32px;
                font-family:Arial,sans-serif;
                text-align:center
              "
            >
              <h1>
                تم ربط Meta بنجاح
              </h1>

              <p>
                يمكنك العودة إلى Dragon Media
                لمراجعة حالة WhatsApp Business.
              </p>
            </main>
          </body>
        </html>
      `)
  } catch (error) {
    console.error(
      'Meta OAuth callback error:',
      error
    )

    if (
      redirectToSettings(
        res,
        'error'
      )
    ) {
      return
    }

    return res
      .status(500)
      .send(
        'حدث خطأ أثناء إكمال اتصال Meta.'
      )
  }
}
