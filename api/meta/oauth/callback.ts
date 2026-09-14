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

interface MetaPage {
  id?: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id?: string
    username?: string
    name?: string
  } | null
}

function getEnv(
  name: string
): string {
  const value =
    process.env[name]

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

  if (
    separator <= 0
  ) {
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
    Buffer.from(
      signature
    )

  const expectedBuffer =
    Buffer.from(
      expected
    )

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
      ).toString(
        'utf8'
      )

    const parsed =
      JSON.parse(
        decoded
      )

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
  provider: MetaProvider =
    'whatsapp'
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

async function graphPost(
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
      )}`,
      {
        method: 'POST',
      }
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

/**
 * Discover Facebook Pages and
 * attached Instagram Business Accounts.
 */
async function discoverMetaPages(
  accessToken: string
): Promise<MetaPage[]> {
  try {
    const {
      response,
      data,
    } =
      await graphRequest(
        '/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}',
        accessToken
      )

    if (
      !response.ok ||
      !Array.isArray(
        data?.data
      )
    ) {
      console.warn(
        'Meta Pages discovery failed:',
        {
          status:
            response.status,
          error:
            data?.error,
        }
      )

      return []
    }

    return data.data
      .filter(
        (page: unknown) =>
          Boolean(
            page &&
              typeof page ===
                'object'
          )
      )
      .map(
        (
          page: MetaPage
        ) => ({
          id:
            typeof page.id ===
            'string'
              ? page.id
              : undefined,

          name:
            typeof page.name ===
            'string'
              ? page.name
              : undefined,

          access_token:
            typeof page.access_token ===
            'string'
              ? page.access_token
              : undefined,

          instagram_business_account:
            page.instagram_business_account &&
            typeof page.instagram_business_account ===
              'object'
              ? {
                  id:
                    typeof page
                      .instagram_business_account
                      .id ===
                    'string'
                      ? page
                          .instagram_business_account
                          .id
                      : undefined,

                  username:
                    typeof page
                      .instagram_business_account
                      .username ===
                    'string'
                      ? page
                          .instagram_business_account
                          .username
                      : undefined,

                  name:
                    typeof page
                      .instagram_business_account
                      .name ===
                    'string'
                      ? page
                          .instagram_business_account
                          .name
                      : undefined,
                }
              : null,
        })
      )
      .filter(
        (
          page: MetaPage
        ) =>
          Boolean(
            page.id
          )
      )
  } catch (
    error
  ) {
    console.warn(
      'Meta Pages discovery error:',
      error
    )

    return []
  }
}

/**
 * Subscribe Facebook Page to
 * Messenger webhook events.
 */
async function subscribeFacebookPage(
  pageId: string,
  pageAccessToken: string
) {
  try {
    const {
      response,
      data,
    } =
      await graphPost(
        `/${encodeURIComponent(
          pageId
        )}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,messaging_referrals`,
        pageAccessToken
      )

    if (
      !response.ok
    ) {
      console.warn(
        'Facebook Messenger webhook subscription failed:',
        {
          pageId,
          status:
            response.status,
          error:
            data?.error,
        }
      )

      return false
    }

    return true
  } catch (
    error
  ) {
    console.warn(
      'Facebook Messenger webhook subscription error:',
      {
        pageId,
        error,
      }
    )

    return false
  }
}

/**
 * Subscribe Instagram Business Account
 * to Instagram Messaging webhooks.
 */
async function subscribeInstagramAccount(
  instagramBusinessAccountId: string,
  pageAccessToken: string
) {
  try {
    const {
      response,
      data,
    } =
      await graphPost(
        `/${encodeURIComponent(
          instagramBusinessAccountId
        )}/subscribed_apps?subscribed_fields=messages`,
        pageAccessToken
      )

    if (
      !response.ok
    ) {
      console.warn(
        'Instagram webhook subscription failed:',
        {
          instagramBusinessAccountId,
          status:
            response.status,
          error:
            data?.error,
        }
      )

      return false
    }

    return true
  } catch (
    error
  ) {
    console.warn(
      'Instagram webhook subscription error:',
      {
        instagramBusinessAccountId,
        error,
      }
    )

    return false
  }
}

/**
 * Discover and subscribe Facebook /
 * Instagram messaging webhooks.
 */
async function configureFacebookInstagramWebhooks(
  accessToken: string
) {
  const pages =
    await discoverMetaPages(
      accessToken
    )

  const facebookPages: Array<{
    id: string
    name: string | null
    webhook_subscribed: boolean
  }> = []

  const instagramAccounts: Array<{
    id: string
    username: string | null
    name: string | null
    webhook_subscribed: boolean
  }> = []

  for (
    const page of pages
  ) {
    if (
      !page.id
    ) {
      continue
    }

    let facebookSubscribed =
      false

    if (
      page.access_token
    ) {
      facebookSubscribed =
        await subscribeFacebookPage(
          page.id,
          page.access_token
        )
    } else {
      console.warn(
        'Facebook Page access token was not returned:',
        page.id
      )
    }

    facebookPages.push({
      id:
        page.id,

      name:
        page.name ||
        null,

      webhook_subscribed:
        facebookSubscribed,
    })

    const instagram =
      page.instagram_business_account

    if (
      instagram?.id
    ) {
      let instagramSubscribed =
        false

      if (
        page.access_token
      ) {
        instagramSubscribed =
          await subscribeInstagramAccount(
            instagram.id,
            page.access_token
          )
      } else {
        console.warn(
          'Instagram subscription skipped because Page access token was not returned:',
          instagram.id
        )
      }

      instagramAccounts.push({
        id:
          instagram.id,

        username:
          instagram.username ||
          null,

        name:
          instagram.name ||
          null,

        webhook_subscribed:
          instagramSubscribed,
      })
    }
  }

  const firstFacebookPage =
    facebookPages[0] ||
    null

  const firstInstagramAccount =
    instagramAccounts[0] ||
    null

  return {
    pages,

    facebookPages,

    instagramAccounts,

    facebookPageId:
      firstFacebookPage?.id ||
      null,

    facebookPageName:
      firstFacebookPage?.name ||
      null,

    facebookWebhookSubscribed:
      facebookPages.some(
        (
          page
        ) =>
          page.webhook_subscribed
      ),

    instagramBusinessAccountId:
      firstInstagramAccount?.id ||
      null,

    instagramUsername:
      firstInstagramAccount?.username ||
      null,

    instagramName:
      firstInstagramAccount?.name ||
      null,

    instagramWebhookSubscribed:
      instagramAccounts.some(
        (
          account
        ) =>
          account.webhook_subscribed
      ),
  }
}

/**
 * Discover WhatsApp data from Meta Embedded Signup.
 *
 * Priority:
 * 1. WABA ID from granular_scopes.
 * 2. WABA owner business.
 * 3. Phone Number ID.
 * 4. WABA webhook subscription.
 * 5. Fallback Business Manager discovery.
 */
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

  let webhookSubscribed =
    false

  /**
   * Step 1:
   * Inspect Embedded Signup token.
   *
   * This is the critical part for Embedded Signup.
   */
  try {
    const appId =
      getEnv(
        'META_APP_ID'
      )

    const appSecret =
      getEnv(
        'META_APP_SECRET'
      )

    const appAccessToken =
      `${appId}|${appSecret}`

    const debugParams =
      new URLSearchParams({
        input_token:
          accessToken,

        access_token:
          appAccessToken,
      })

    const debugResponse =
      await fetch(
        `https://graph.facebook.com/${META_AUTH_VERSION}/debug_token?${debugParams.toString()}`
      )

    const debugData =
      await debugResponse
        .json()
        .catch(() => null)

    if (
      debugResponse.ok &&
      debugData?.data
    ) {
      const tokenData =
        debugData.data

      const granularScopes =
        Array.isArray(
          tokenData.granular_scopes
        )
          ? tokenData.granular_scopes
          : []

      /**
       * Preferred:
       * whatsapp_business_management target IDs.
       */
      const managementScope =
        granularScopes.find(
          (
            scope: unknown
          ) =>
            scope &&
            typeof scope ===
              'object' &&
            (
              scope as {
                scope?: string
              }
            ).scope ===
              'whatsapp_business_management'
        )

      const managementTargetIds =
        managementScope &&
        typeof managementScope ===
          'object' &&
        Array.isArray(
          (
            managementScope as {
              target_ids?: unknown
            }
          ).target_ids
        )
          ? (
              managementScope as {
                target_ids: unknown[]
              }
            ).target_ids
              .filter(
                (
                  id
                ): id is
                  | string
                  | number =>
                  typeof id ===
                    'string' ||
                  typeof id ===
                    'number'
              )
              .map(
                String
              )
          )
          : []

      if (
        managementTargetIds.length >
        0
      ) {
        wabaId =
          managementTargetIds[0]
      }

      /**
       * Fallback:
       * Some Meta configurations may associate
       * WABA targets with messaging permission.
       */
      if (
        !wabaId
      ) {
        const messagingScope =
          granularScopes.find(
            (
              scope: unknown
            ) =>
              scope &&
              typeof scope ===
                'object' &&
              (
                scope as {
                  scope?: string
                }
              ).scope ===
                'whatsapp_business_messaging'
          )

        const messagingTargetIds =
          messagingScope &&
          typeof messagingScope ===
            'object' &&
          Array.isArray(
            (
              messagingScope as {
                target_ids?: unknown
              }
            ).target_ids
          )
            ? (
                messagingScope as {
                  target_ids: unknown[]
                }
              ).target_ids
                .filter(
                  (
                    id
                  ): id is
                    | string
                    | number =>
                    typeof id ===
                      'string' ||
                    typeof id ===
                      'number'
                )
                .map(
                  String
                )
            )
            : []

        if (
          messagingTargetIds.length >
          0
        ) {
          wabaId =
            messagingTargetIds[0]
        }
      }

      console.log(
        'WhatsApp Embedded Signup token inspected:',
        {
          is_valid:
            tokenData.is_valid,

          meta_user_id:
            tokenData.user_id,

          scopes:
            Array.isArray(
              tokenData.scopes
            )
              ? tokenData.scopes
              : [],

          has_whatsapp_business_management:
            granularScopes.some(
              (
                scope: unknown
              ) =>
                scope &&
                typeof scope ===
                  'object' &&
                (
                  scope as {
                    scope?: string
                  }
                ).scope ===
                  'whatsapp_business_management'
            ),

          whatsapp_waba_target_count:
            managementTargetIds.length,
        }
      )
    } else {
      console.warn(
        'WhatsApp debug_token failed:',
        {
          status:
            debugResponse.status,

          error:
            debugData?.error,
        }
      )
    }
  } catch (
    error
  ) {
    console.warn(
      'WhatsApp Embedded Signup token inspection failed:',
      error
    )
  }

  /**
   * Step 2:
   * Resolve WABA owner business and
   * normalize WABA ID.
   */
  if (
    wabaId
  ) {
    try {
      const {
        response,
        data,
      } =
        await graphRequest(
          `/${encodeURIComponent(
            wabaId
          )}?fields=id,name,owner_business_info`,
          accessToken
        )

      if (
        response.ok
      ) {
        if (
          data?.id
        ) {
          wabaId =
            String(
              data.id
            )
        }

        const ownerBusinessId =
          data?.owner_business_info?.id

        if (
          ownerBusinessId
        ) {
          businessId =
            String(
              ownerBusinessId
            )
        }
      } else {
        console.warn(
          'WhatsApp WABA lookup failed:',
          {
            wabaId,

            status:
              response.status,

            error:
              data?.error,
          }
        )
      }
    } catch (
      error
    ) {
      console.warn(
        'WhatsApp WABA lookup error:',
        error
      )
    }
  }

  /**
   * Step 3:
   * Fallback to Business Manager only
   * if Embedded Signup didn't provide WABA.
   */
  if (
    !wabaId
  ) {
    try {
      const {
        response,
        data,
      } =
        await graphRequest(
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
        data.data.length >
          0
      ) {
        businessId =
          String(
            data.data[0].id
          )
      }
    } catch (
      error
    ) {
      console.warn(
        'WhatsApp business discovery failed:',
        error
      )
    }

    if (
      businessId
    ) {
      /**
       * Owned WABAs.
       */
      try {
        const {
          response,
          data,
        } =
          await graphRequest(
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
          data.data.length >
            0
        ) {
          wabaId =
            String(
              data.data[0].id
            )
        }
      } catch (
        error
      ) {
        console.warn(
          'WhatsApp owned WABA discovery failed:',
          error
        )
      }

      /**
       * Shared/client WABAs.
       */
      if (
        !wabaId
      ) {
        try {
          const {
            response,
            data,
          } =
            await graphRequest(
              `/${encodeURIComponent(
                businessId
              )}/client_whatsapp_business_accounts?fields=id,name`,
              accessToken
            )

          if (
            response.ok &&
            Array.isArray(
              data?.data
            ) &&
            data.data.length >
              0
          ) {
            wabaId =
              String(
                data.data[0].id
              )
          }
        } catch (
          error
        ) {
          console.warn(
            'WhatsApp shared WABA discovery failed:',
            error
          )
        }
      }
    }
  }

  /**
   * Step 4:
   * Discover phone number.
   */
  if (
    wabaId
  ) {
    try {
      const {
        response,
        data,
      } =
        await graphRequest(
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
        data.data.length >
          0
      ) {
        const phone =
          data.data[0]

        phoneNumberId =
          phone?.id
            ? String(
                phone.id
              )
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
      } else {
        console.warn(
          'WhatsApp phone number discovery failed:',
          {
            wabaId,

            status:
              response.status,

            error:
              data?.error,
          }
        )
      }
    } catch (
      error
    ) {
      console.warn(
        'WhatsApp phone number discovery error:',
        error
      )
    }
  }

  /**
   * Step 5:
   * Subscribe WABA to WhatsApp webhook.
   */
  if (
    wabaId &&
    phoneNumberId
  ) {
    try {
      const {
        response,
        data,
      } =
        await graphPost(
          `/${encodeURIComponent(
            wabaId
          )}/subscribed_apps`,
          accessToken
        )

      if (
        response.ok
      ) {
        webhookSubscribed =
          true
      } else {
        console.warn(
          'WhatsApp WABA webhook subscription failed:',
          {
            wabaId,

            status:
              response.status,

            error:
              data?.error,
          }
        )
      }
    } catch (
      error
    ) {
      console.warn(
        'WhatsApp WABA webhook subscription error:',
        error
      )
    }
  }

  console.log(
    'WhatsApp Embedded Signup discovery result:',
    {
      metaUserId,

      businessId,

      wabaId,

      phoneNumberId,

      displayPhoneNumber,

      verifiedName,

      webhookSubscribed,

      readyForMessaging:
        Boolean(
          wabaId &&
          phoneNumberId
        ),
    }
  )

  return {
    businessId,

    wabaId,

    phoneNumberId,

    displayPhoneNumber,

    verifiedName,

    webhookSubscribed,
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

  if (
    req.method !==
    'GET'
  ) {
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

    let preliminaryState:
      | MetaState
      | null = null

    if (
      state
    ) {
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

    if (
      metaError
    ) {
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

    if (
      !stateData
    ) {
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
        'SUPABASE_SECRET_KEY'
      )

    /**
     * Exchange authorization code
     * server-side.
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

    /**
     * Token expiration.
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
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        }
      )

    /**
     * Validate organization.
     */
    const {
      data: organization,
      error:
        organizationError,
    } =
      await admin
        .from(
          'organizations'
        )
        .select(
          'id'
        )
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

    /**
     * Validate user membership.
     */
    const {
      data: membership,
      error:
        membershipError,
    } =
      await admin
        .from(
          'users'
        )
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

    /**
     * Validate Meta identity.
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

    let whatsappWebhookSubscribed =
      false

    let facebookPageId:
      | string
      | null = null

    let facebookPageName:
      | string
      | null = null

    let facebookWebhookSubscribed =
      false

    let instagramBusinessAccountId:
      | string
      | null = null

    let instagramUsername:
      | string
      | null = null

    let instagramName:
      | string
      | null = null

    let instagramWebhookSubscribed =
      false

    let facebookPagesMetadata:
      Array<{
        id: string
        name: string | null
        webhook_subscribed: boolean
      }> = []

    let instagramAccountsMetadata:
      Array<{
        id: string
        username: string | null
        name: string | null
        webhook_subscribed: boolean
      }> = []

    /**
     * WhatsApp.
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

      whatsappWebhookSubscribed =
        whatsappData.webhookSubscribed
    }

    /**
     * Facebook / Instagram.
     */
    if (
      provider ===
        'facebook' ||
      provider ===
        'instagram'
    ) {
      const metaPages =
        await configureFacebookInstagramWebhooks(
          accessToken
        )

      facebookPageId =
        metaPages.facebookPageId

      facebookPageName =
        metaPages.facebookPageName

      facebookWebhookSubscribed =
        metaPages.facebookWebhookSubscribed

      instagramBusinessAccountId =
        metaPages.instagramBusinessAccountId

      instagramUsername =
        metaPages.instagramUsername

      instagramName =
        metaPages.instagramName

      instagramWebhookSubscribed =
        metaPages.instagramWebhookSubscribed

      facebookPagesMetadata =
        metaPages.facebookPages

      instagramAccountsMetadata =
        metaPages.instagramAccounts
    }

    const now =
      new Date().toISOString()

    /**
     * Existing connection.
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

            whatsapp_webhook_subscribed:
              whatsappWebhookSubscribed,

            ready_for_messaging:
              Boolean(
                wabaId &&
                phoneNumberId
              ),
          }
        : {}),

      ...(provider ===
      'facebook'
        ? {
            facebook_page_id:
              facebookPageId,

            facebook_page_name:
              facebookPageName,

            facebook_webhook_subscribed:
              facebookWebhookSubscribed,

            facebook_pages:
              facebookPagesMetadata,

            ready_for_messaging:
              Boolean(
                facebookPageId &&
                facebookWebhookSubscribed
              ),
          }
        : {}),

      ...(provider ===
      'instagram'
        ? {
            instagram_business_account_id:
              instagramBusinessAccountId,

            instagram_username:
              instagramUsername,

            instagram_name:
              instagramName,

            instagram_webhook_subscribed:
              instagramWebhookSubscribed,

            instagram_accounts:
              instagramAccountsMetadata,

            ready_for_messaging:
              Boolean(
                instagramBusinessAccountId &&
                instagramWebhookSubscribed
