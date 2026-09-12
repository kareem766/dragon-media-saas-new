import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'node:crypto'

const META_AUTH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

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
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed')
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

    const error =
      typeof req.query.error === 'string'
        ? req.query.error
        : null

    const errorDescription =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : null

    if (error) {
      console.error('Meta OAuth denied:', {
        error,
        errorDescription,
      })

      return res.status(400).send(
        'لم يتم إكمال ربط Meta. يمكنك العودة إلى Dragon Media والمحاولة مرة أخرى.'
      )
    }

    if (!code || !state) {
      return res.status(400).send(
        'طلب Meta غير مكتمل.'
      )
    }

    const stateData = verifyState(
      state,
      getEnv('META_STATE_SECRET')
    )

    if (!stateData) {
      return res.status(400).send(
        'رابط الربط غير صالح أو انتهت صلاحيته.'
      )
    }

    if (
      !stateData.organization_id ||
      !stateData.user_id ||
      !stateData.issued_at
    ) {
      return res.status(400).send(
        'بيانات جلسة الربط غير صالحة.'
      )
    }

    const stateAge = Date.now() - Number(stateData.issued_at)

    if (stateAge < 0 || stateAge > 10 * 60 * 1000) {
      return res.status(400).send(
        'انتهت صلاحية جلسة ربط Meta. ابدأ عملية الربط مرة أخرى.'
      )
    }

    const appId = getEnv('META_APP_ID')
    const appSecret = getEnv('META_APP_SECRET')
    const redirectUri = getEnv('META_REDIRECT_URI')

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    })

    const tokenResponse = await fetch(
      `https://graph.facebook.com/${META_AUTH_VERSION}/oauth/access_token?${tokenParams.toString()}`
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Meta OAuth token exchange failed:', {
        status: tokenResponse.status,
        error: tokenData?.error,
      })

      return res.status(502).send(
        'تعذر إكمال الاتصال مع Meta. حاول مرة أخرى.'
      )
    }

    const accessToken = tokenData.access_token as string

    /*
     * The access token is intentionally NOT returned to the browser.
     * It will be persisted server-side after the Meta business assets
     * are resolved and validated.
     */

    const supabase = createClient(
      getEnv('VITE_SUPABASE_URL'),
      getEnv('VITE_SUPABASE_ANON_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    /*
     * Validate that the organization referenced by the signed OAuth state
     * still exists before continuing.
     */
    const { data: organization, error: organizationError } =
      await supabase
        .from('organizations')
        .select('id')
        .eq('id', stateData.organization_id)
        .maybeSingle()

    if (organizationError || !organization) {
      console.error(
        'Meta OAuth organization validation failed:',
        organizationError
      )

      return res.status(403).send(
        'تعذر التحقق من الشركة المرتبطة بعملية الربط.'
      )
    }

    /*
     * Validate the authenticated user still belongs to this organization.
     */
    const { data: membership, error: membershipError } =
      await supabase
        .from('users')
        .select('organization_id')
        .eq('id', stateData.user_id)
        .eq('organization_id', stateData.organization_id)
        .maybeSingle()

    if (membershipError || !membership) {
      console.error(
        'Meta OAuth membership validation failed:',
        membershipError
      )

      return res.status(403).send(
        'لم يعد المستخدم مصرحًا بربط Meta بهذه الشركة.'
      )
    }

    /*
     * At this stage the OAuth exchange succeeded and the organization
     * has been validated.
     *
     * We deliberately do not write the access token into the browser
     * or into the integrations table from this callback yet.
     *
     * The next implementation step will securely resolve the
     * WhatsApp Business Account / phone number / Facebook assets,
     * then persist the encrypted credentials server-side.
     */

    void accessToken

    return res.status(200).send(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>تم الاتصال</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f8fafc;
              font-family: Arial, sans-serif;
              color: #0f172a;
            }

            .card {
              width: min(92%, 460px);
              padding: 32px;
              border-radius: 20px;
              background: white;
              box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
              text-align: center;
            }

            h1 {
              margin: 0 0 12px;
              font-size: 24px;
            }

            p {
              margin: 0;
              line-height: 1.8;
              color: #64748b;
            }
          </style>
        </head>

        <body>
          <div class="card">
            <h1>تم التحقق من اتصال Meta</h1>
            <p>
              تم استلام صلاحية الاتصال بنجاح.
              سيتم إكمال إعداد حساب WhatsApp Business داخل Dragon Media.
            </p>
          </div>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Meta OAuth callback error:', error)

    return res.status(500).send(
      'حدث خطأ أثناء إكمال اتصال Meta.'
    )
  }
}
