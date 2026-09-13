import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

const META_AUTH_VERSION =
  process.env.META_GRAPH_API_VERSION ||
  'v23.0'

type MetaProvider =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'

interface MetaState {
  user_id: string
  organization_id: string
  provider: MetaProvider
  nonce: string
  issued_at: number
}

function getEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    )
  }

  return value
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

function verifyState(
  state: string,
  secret: string
): MetaState | null {
  const separator =
    state.lastIndexOf('.')

  if (separator <= 0) {
    return null
  }

  const payload =
    state.slice(
      0,
      separator
    )

  const signature =
    state.slice(
      separator + 1
    )

  const expected =
    createHmac(
      'sha256',
      secret
    )
      .update(payload)
      .digest('base64url')

  const providedBuffer =
    Buffer.from(signature)

  const expectedBuffer =
    Buffer.from(expected)

  if (
    providedBuffer.length !==
      expectedBuffer.length ||
    !timingSafeEqual(
      providedBuffer,
      expectedBuffer
    )
  ) {
    return null
  }

  try {
    const decoded =
      Buffer.from(
        payload,
        'base64url'
      ).toString('utf8')

    const parsed =
      JSON.parse(decoded)

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      return null
    }

    return parsed as MetaState
  } catch {
    return null
  }
}

function redirectToSettings(
  res: VercelResponse,
  status:
    | 'connected'
    | 'error',
  provider: MetaProvider = 'whatsapp'
) {
  const redirectUri =
    process.env.META_REDIRECT_URI

  if (!redirectUri) {
    return false
  }

  try {
    const origin =
      new URL(
        redirectUri
      ).origin

    const url =
      `${origin}/#/settings?meta=${status}&provider=${encodeURIComponent(provider)}`

    res.redirect(
      303,
      url
    )

    return true
  } catch {
    return false
  }
}

async function graphRequest(
  path: string,
  accessToken: string
) {
  const separator =
    path.includes('?')
      ? '&'
      : '?'

  const response =
    await fetch(
      `https://graph.facebook.com/${META_AUTH_VERSION}${path}${separator}access_token=${encodeURIComponent(
        accessToken
      )}`
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

async function discoverWhatsAppData(
  accessToken: string,
  metaUserId: string
) {
  let businessId:
    | string
    | null = null

  let wabaId:
    | string
    | null = null

  let phoneNumberId:
    | string
    | null = null

  let displayPhoneNumber:
    | string
    | null = null

  let verifiedName:
    | string
    | null = null

  /*
   * Try to discover businesses available
   * to the Meta user.
   *
   * Failure here is not fatal because
   * some Meta app configurations only
   * return the user token initially.
   */
  try {
    const {
      response,
      data,
    } = await graphRequest(
      `/${encodeURIComponent(
        metaUserId
      )}/businesses?fields=id,name`,
      accessToken
    )

    if (
      response.ok &&
      Array.isArray(
        data?.data
      ) &&
      data.data.length > 0
    ) {
      businessId =
        String(
          data.data[0].id
        )
    }
  } catch (error) {
    console.warn(
      'WhatsApp business discovery failed:',
      error
    )
  }

  /*
   * Discover WABA owned by the business.
   */
  if (businessId) {
    try {
      const {
        response,
        data,
      } = await graphRequest(
        `/${encodeURIComponent(
          businessId
        )}/owned_whatsapp_business_accounts?fields=id,name`,
        accessToken
      )

      if (
        response.ok &&
        Array.isArray(
          data?.data
        ) &&
        data.data.length > 0
      ) {
        wabaId =
          String(
            data.data[0].id
          )
      }
    } catch (error) {
      console.warn(
        'WhatsApp WABA discovery failed:',
        error
      )
    }
  }

  /*
   * Discover the first phone number
   * available on the WABA.
   */
  if (wabaId) {
    try {
      const {
        response,
        data,
      } = await graphRequest(
        `/${encodeURIComponent(
          wabaId
        )}/phone_numbers?fields=id,display_phone_number,verified_name`,
        accessToken
      )

      if (
        response.ok &&
        Array.isArray(
          data?.data
        ) &&
        data.data.length > 0
      ) {
        const phone =
          data.data[0]

        phoneNumberId =
          phone?.id
            ? String(phone.id)
            : null

        displayPhoneNumber =
          typeof phone?.display_phone_number ===
          'string'
            ? phone.display_phone_number
            : null

        verifiedName =
          typeof phone?.verified_name ===
          'string'
            ? phone.verified_name
            : null
      }
    } catch (error) {
      console.warn(
        'WhatsApp phone discovery failed:',
        error
      )
    }
  }

  return {
    businessId,
    wabaId,
    phoneNumberId,
    displayPhoneNumber,
    verifiedName,
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
      .send(
        'Method not allowed'
      )
  }

  let provider:
    MetaProvider =
    'whatsapp'

  try {
    const code =
      typeof req.query.code ===
      'string'
        ? req.query.code
        : null

    const state =
      typeof req.query.state ===
      'string'
        ? req.query.state
        : null

    const metaError =
      typeof req.query.error ===
      'string'
        ? req.query.error
        : null

    const errorDescription =
      typeof req.query.error_description ===
      'string'
        ? req.query.error_description
        : null

    /*
     * We cannot trust provider from the
     * callback query. Provider must come
     * from the signed state.
     */
    let preliminaryState:
      | MetaState
      | null = null

    if (state) {
      preliminaryState =
        verifyState(
          state,
          getEnv(
            'META_STATE_SECRET'
          )
        )

      if (
        preliminaryState?.provider
      ) {
        provider =
          getProvider(
            preliminaryState.provider
          )
      }
    }

    if (metaError) {
      console.error(
        'Meta OAuth denied:',
        {
          error:
            metaError,
          errorDescription,
          provider,
        }
      )

      if (
        redirectToSettings(
          res,
          'error',
          provider
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

    if (
      !code ||
      !state
    ) {
      return res
        .status(400)
        .send(
          'طلب Meta غير مكتمل.'
        )
    }

    const stateData =
      preliminaryState ||
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

    provider =
      getProvider(
        stateData.provider
      )

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
      getEnv(
        'META_APP_ID'
      )

    const appSecret =
      getEnv(
        'META_APP_SECRET'
      )

    const redirectUri =
      getEnv(
        'META_REDIRECT_URI'
      )

    const supabaseUrl =
      getEnv(
        'VITE_SUPABASE_URL'
      )

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
        client_id:
          appId,

        client_secret:
          appSecret,

        redirect_uri:
          redirectUri,

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
          'error',
          provider
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
      String(
        tokenData.access_token
      )

    /*
     * Never expose this token to the
     * browser or store it in the
     * frontend-readable integrations
     * table.
     */
    const expiresIn =
      Number(
        tokenData.expires_in
      )

    const tokenExpiresAt =
      Number.isFinite(
        expiresIn
      ) &&
      expiresIn > 0
        ? new Date(
            Date.now() +
              expiresIn *
                1000
          ).toISOString()
        : null

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
    } =
      await admin
        .from(
          'organizations'
        )
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
    } =
      await admin
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
     * Validate Meta access token.
     */
    const {
      response:
        meResponse,
      data:
        meData,
    } =
      await graphRequest(
        '/me?fields=id,name',
        accessToken
      )

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
          'error',
          provider
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

    const metaUserId =
      String(
        meData.id
      )

    const metaUserName =
      typeof meData.name ===
      'string'
        ? meData.name
        : null

    let businessId:
      | string
      | null = null

    let wabaId:
      | string
      | null = null

    let phoneNumberId:
      | string
      | null = null

    let displayPhoneNumber:
      | string
      | null = null

    let verifiedName:
      | string
      | null = null

    /*
     * WhatsApp-specific discovery.
     */
    if (
      provider ===
      'whatsapp'
    ) {
      const whatsappData =
        await discoverWhatsAppData(
          accessToken,
          metaUserId
        )

      businessId =
        whatsappData.businessId

      wabaId =
        whatsappData.wabaId

      phoneNumberId =
        whatsappData.phoneNumberId

      displayPhoneNumber =
        whatsappData.displayPhoneNumber

      verifiedName =
        whatsappData.verifiedName
    }

    const now =
      new Date().toISOString()

    /*
     * Store sensitive credentials ONLY
     * inside the server-only
     * meta_connections table.
     */
    const {
      data:
        existingConnection,
    } =
      await admin
        .from(
          'meta_connections'
        )
        .select(
          'id, metadata'
        )
        .eq(
          'organization_id',
          stateData.organization_id
        )
        .eq(
          'provider',
          provider
        )
        .maybeSingle()

    const existingConnectionMetadata =
      existingConnection?.metadata &&
      typeof existingConnection.metadata ===
        'object'
        ? existingConnection.metadata
        : {}

    const connectionMetadata = {
      ...existingConnectionMetadata,

      meta_user_name:
        metaUserName,

      connection_type:
        'meta_login_business',

      last_oauth_verified_at:
        now,

      ready_for_messaging:
        provider ===
          'whatsapp'
          ? Boolean(
              wabaId &&
                phoneNumberId
            )
          : true,
    }

    const connectionPayload = {
      organization_id:
        stateData.organization_id,

      provider,

      access_token:
        accessToken,

      token_expires_at:
        tokenExpiresAt,

      meta_user_id:
        metaUserId,

      business_id:
        businessId,

      waba_id:
        wabaId,

      phone_number_id:
        phoneNumberId,

      display_phone_number:
        displayPhoneNumber,

      verified_name:
        verifiedName,

      status:
        'connected',

      metadata:
        connectionMetadata,

      updated_at:
        now,
    }

    let connectionResult

    if (
      existingConnection?.id
    ) {
      connectionResult =
        await admin
          .from(
            'meta_connections'
          )
          .update(
            connectionPayload
          )
          .eq(
            'id',
            existingConnection.id
          )
    } else {
      connectionResult =
        await admin
          .from(
            'meta_connections'
          )
          .insert(
            connectionPayload
          )
    }

    if (
      connectionResult.error
    ) {
      console.error(
        'Meta credential persistence failed:',
        connectionResult.error
      )

      return res
        .status(500)
        .send(
          'تم التحقق من Meta لكن تعذر حفظ بيانات الاتصال الآمنة.'
        )
    }

    /*
     * IMPORTANT:
     *
     * integrations.metadata must never
     * contain access_token.
     */
    const {
      data:
        existingIntegration,
      error:
        existingIntegrationError,
    } =
      await admin
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
          provider
        )
        .maybeSingle()

    if (
      existingIntegrationError
    ) {
      console.error(
        'Meta OAuth integration lookup failed:',
        existingIntegrationError
      )

      return res
        .status(500)
        .send(
          'تم حفظ الاتصال الآمن لكن تعذر تحديث حالة التكامل.'
        )
    }

    const existingIntegrationMetadata =
      existingIntegration?.metadata &&
      typeof existingIntegration.metadata ===
        'object'
        ? existingIntegration.metadata
        : {}

    const integrationMetadata = {
      ...existingIntegrationMetadata,

      meta_user_id:
        metaUserId,

      meta_user_name:
        metaUserName,

      connection_type:
        'meta_login_business',

      last_oauth_verified_at:
        now,

      ...(provider ===
      'whatsapp'
        ? {
            business_id:
              businessId,

            waba_id:
              wabaId,

            phone_number_id:
              phoneNumberId,

            display_phone_number:
              displayPhoneNumber,

            verified_name:
              verifiedName,

            ready_for_messaging:
              Boolean(
                wabaId &&
                  phoneNumberId
              ),
          }
        : {}),
    }

    const integrationPayload = {
      organization_id:
        stateData.organization_id,

      provider,

      connected: true,

      status:
        'connected',

      metadata:
        integrationMetadata,

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

    if (
      existingIntegration?.id
    ) {
      integrationResult =
        await admin
          .from(
            'integrations'
          )
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
          .from(
            'integrations'
          )
          .insert(
            integrationPayload
          )
    }

    if (
      integrationResult.error
    ) {
      console.error(
        'Meta OAuth integration persistence failed:',
        integrationResult.error
      )

      return res
        .status(500)
        .send(
          'تم حفظ اتصال Meta لكن تعذر تحديث حالة التكامل.'
        )
    }

    /*
     * Never return the access token.
     */
    if (
      redirectToSettings(
        res,
        'connected',
        provider
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
                لمراجعة حالة التكامل.
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
        'error',
        provider
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
