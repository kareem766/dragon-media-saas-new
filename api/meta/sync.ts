import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v23.0'

type MetaProvider =
  | 'facebook'
  | 'instagram'
  | 'whatsapp'

function env(name: string): string {
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
): MetaProvider | null {
  if (
    value === 'facebook' ||
    value === 'instagram' ||
    value === 'whatsapp'
  ) {
    return value
  }

  return null
}

async function graphRequest(
  path: string,
  accessToken: string
) {
  const separator =
    path.includes('?')
      ? '&'
      : '?'

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}${path}${separator}access_token=${encodeURIComponent(
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

function errorMessage(
  data: any,
  fallback: string
) {
  return (
    data?.error?.message ||
    data?.message ||
    fallback
  )
}

/* -------------------------------------------------------------------------- */
/* Facebook                                                                    */
/* -------------------------------------------------------------------------- */

async function discoverFacebookData(
  accessToken: string
) {
  const pages: Array<{
    id: string
    name: string | null
    category: string | null
    access_token_available: boolean
  }> = []

  const {
    response,
    data,
  } = await graphRequest(
    '/me/accounts?fields=id,name,category,access_token',
    accessToken
  )

  if (!response.ok) {
    throw new Error(
      errorMessage(
        data,
        'Unable to discover Facebook Pages'
      )
    )
  }

  if (Array.isArray(data?.data)) {
    for (const page of data.data) {
      if (!page?.id) {
        continue
      }

      pages.push({
        id: String(page.id),

        name:
          typeof page.name === 'string'
            ? page.name
            : null,

        category:
          typeof page.category === 'string'
            ? page.category
            : null,

        access_token_available:
          typeof page.access_token ===
            'string' &&
          page.access_token.length > 0,
      })
    }
  }

  return {
    pages,
    page_count: pages.length,
    ready_for_messaging:
      pages.some(
        (page) =>
          page.access_token_available
      ),
  }
}

/* -------------------------------------------------------------------------- */
/* Instagram                                                                   */
/* -------------------------------------------------------------------------- */

async function discoverInstagramData(
  accessToken: string
) {
  const accounts: Array<{
    page_id: string
    page_name: string | null
    instagram_business_account_id: string
    instagram_username: string | null
    instagram_name: string | null
  }> = []

  const {
    response,
    data,
  } = await graphRequest(
    '/me/accounts?fields=id,name,instagram_business_account{id,username,name}',
    accessToken
  )

  if (!response.ok) {
    throw new Error(
      errorMessage(
        data,
        'Unable to discover Instagram Business Accounts'
      )
    )
  }

  if (Array.isArray(data?.data)) {
    for (const page of data.data) {
      const instagram =
        page?.instagram_business_account

      if (
        !page?.id ||
        !instagram?.id
      ) {
        continue
      }

      accounts.push({
        page_id:
          String(page.id),

        page_name:
          typeof page.name === 'string'
            ? page.name
            : null,

        instagram_business_account_id:
          String(instagram.id),

        instagram_username:
          typeof instagram.username ===
          'string'
            ? instagram.username
            : null,

        instagram_name:
          typeof instagram.name ===
          'string'
            ? instagram.name
            : null,
      })
    }
  }

  return {
    accounts,

    account_count:
      accounts.length,

    ready_for_messaging:
      accounts.length > 0,
  }
}

/* -------------------------------------------------------------------------- */
/* WhatsApp                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Embedded Signup / Login for Business can expose the WhatsApp Business
 * Account IDs granted to the user token through granular_scopes.
 *
 * This avoids relying on:
 *
 *   /{metaUserId}/businesses
 *
 * which can fail with:
 *
 *   (#100) Missing Permission
 *
 * even when the WhatsApp Business permissions themselves are correctly
 * granted to the configuration.
 */
async function discoverWhatsAppWabaIds(
  accessToken: string
) {
  const appId =
    env('META_APP_ID')

  const appSecret =
    env('META_APP_SECRET')

  const appAccessToken =
    `${appId}|${appSecret}`

  const {
    response,
    data,
  } = await graphRequest(
    `/debug_token?input_token=${encodeURIComponent(
      accessToken
    )}`,
    appAccessToken
  )

  if (!response.ok) {
    throw new Error(
      `debug_token: ${errorMessage(
        data,
        'Unable to validate WhatsApp access token'
      )}`
    )
  }

  const granularScopes =
    Array.isArray(
      data?.data?.granular_scopes
    )
      ? data.data.granular_scopes
      : []

  const whatsappScope =
    granularScopes.find(
      (item: any) =>
        item?.scope ===
        'whatsapp_business_management'
    )

  const targetIds =
    Array.isArray(
      whatsappScope?.target_ids
    )
      ? whatsappScope.target_ids
      : []

  const wabaIds =
    targetIds
      .filter(
        (id: unknown) =>
          typeof id === 'string' ||
          typeof id === 'number'
      )
      .map(
        (id: string | number) =>
          String(id)
      )
      .filter(Boolean)

  return {
    wabaIds,
    granularScopes,
    debugData:
      data?.data || null,
  }
}

async function discoverWhatsAppData(
  accessToken: string
) {
  let businessId:
    | string
    | null = null

  let businessName:
    | string
    | null = null

  let wabaId:
    | string
    | null = null

  let wabaName:
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

  const discoveryErrors: string[] = []

  /* --------------------------- Discover WABA IDs -------------------------- */

  try {
    const {
      wabaIds,
    } =
      await discoverWhatsAppWabaIds(
        accessToken
      )

    if (wabaIds.length > 0) {
      wabaId =
        wabaIds[0]
    } else {
      discoveryErrors.push(
        'waba: No WhatsApp Business Account was returned by the authorized Meta token'
      )
    }
  } catch (error) {
    discoveryErrors.push(
      `waba_token: ${
        error instanceof Error
          ? error.message
          : 'Unable to discover WhatsApp Business Account'
      }`
    )
  }

  /* --------------------------- WABA information --------------------------- */

  if (wabaId) {
    try {
      const {
        response,
        data,
      } = await graphRequest(
        `/${encodeURIComponent(
          wabaId
        )}?fields=id,name,owner_business_info`,
        accessToken
      )

      if (!response.ok) {
        discoveryErrors.push(
          `waba_info: ${errorMessage(
            data,
            'request failed'
          )}`
        )
      } else {
        if (
          typeof data?.name ===
          'string'
        ) {
          wabaName =
            data.name
        }

        const ownerBusiness =
          data?.owner_business_info

        if (
          ownerBusiness?.id
        ) {
          businessId =
            String(
              ownerBusiness.id
            )
        }

        if (
          typeof ownerBusiness?.name ===
          'string'
        ) {
          businessName =
            ownerBusiness.name
        }
      }
    } catch {
      discoveryErrors.push(
        'waba_info: request exception'
      )
    }
  }

  /* ---------------------- Business fallback information ------------------- */

  /**
   * If the WABA does not expose owner_business_info,
   * do not call /{metaUserId}/businesses again.
   *
   * That endpoint was the source of the Missing Permission error.
   *
   * We keep businessId/businessName nullable because WABA + phone number
   * are the resources actually required for WhatsApp messaging.
   */

  /* ----------------------------- Phone number ----------------------------- */

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

      if (!response.ok) {
        discoveryErrors.push(
          `phone_numbers: ${errorMessage(
            data,
            'request failed'
          )}`
        )
      } else if (
        Array.isArray(data?.data) &&
        data.data.length > 0
      ) {
        const phone =
          data.data[0]

        if (phone?.id) {
          phoneNumberId =
            String(phone.id)
        }

        if (
          typeof phone?.display_phone_number ===
          'string'
        ) {
          displayPhoneNumber =
            phone.display_phone_number
        }

        if (
          typeof phone?.verified_name ===
          'string'
        ) {
          verifiedName =
            phone.verified_name
        }
      } else {
        discoveryErrors.push(
          'phone_numbers: No WhatsApp phone number was returned for the WABA'
        )
      }
    } catch {
      discoveryErrors.push(
        'phone_numbers: request exception'
      )
    }
  }

  return {
    businessId,
    businessName,
    wabaId,
    wabaName,
    phoneNumberId,
    displayPhoneNumber,
    verifiedName,
    readyForMessaging:
      Boolean(
        wabaId &&
        phoneNumberId
      ),
    discoveryErrors,
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader(
    'Cache-Control',
    'no-store'
  )

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        error:
          'Method not allowed',
      })
  }

  try {
    const authorization =
      req.headers.authorization || ''

    const accessToken =
      authorization.startsWith(
        'Bearer '
      )
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

    const provider =
      getProvider(
        req.body?.provider
      )

    if (!provider) {
      return res
        .status(400)
        .json({
          error:
            'Invalid Meta provider',
        })
    }

    const supabaseUrl =
      env(
        'VITE_SUPABASE_URL'
      )

    const publicKey =
      env(
        'VITE_SUPABASE_ANON_KEY'
      )

    const serviceKey =
      env(
        'SUPABASE_SECRET_KEY'
      )

    /* -------------------------- Authenticate user ------------------------- */

    const authSupabase =
      createClient(
        supabaseUrl,
        publicKey,
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
      await authSupabase.auth.getUser(
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

    /* ----------------------------- Admin client --------------------------- */

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

    /* ---------------------------- Organization ---------------------------- */

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

    const organizationId =
      membership.organization_id

    /* ------------------------- Existing connection ------------------------ */

    const {
      data: connection,
      error: connectionError,
    } =
      await admin
        .from(
          'meta_connections'
        )
        .select(
          'id,organization_id,provider,access_token,token_expires_at,meta_user_id,status,metadata'
        )
        .eq(
          'organization_id',
          organizationId
        )
        .eq(
          'provider',
          provider
        )
        .maybeSingle()

    if (connectionError) {
      console.error(
        'Meta sync connection lookup error:',
        connectionError
      )

      return res
        .status(500)
        .json({
          error:
            'Unable to load Meta connection',
          code:
            'META_CONNECTION_LOOKUP_FAILED',
        })
    }

    if (!connection) {
      return res
        .status(404)
        .json({
          error:
            'Meta connection not found',
          provider,
        })
    }

    if (
      !connection.access_token
    ) {
      return res
        .status(409)
        .json({
          error:
            'Meta connection does not contain a server-side access token',
          provider,
        })
    }

    const metaUserId =
      connection.meta_user_id

    if (!metaUserId) {
      return res
        .status(409)
        .json({
          error:
            'Meta user identity is missing from the connection',
          provider,
        })
    }

    const token =
      connection.access_token

    /* -------------------------- Validate token ---------------------------- */

    const {
      response:
        meResponse,
      data:
        meData,
    } =
      await graphRequest(
        '/me?fields=id,name',
        token
      )

    if (
      !meResponse.ok ||
      !meData?.id
    ) {
      const message =
        errorMessage(
          meData,
          'Meta access token is invalid or expired'
        )

      await admin
        .from(
          'meta_connections'
        )
        .update({
          status:
            'error',

          metadata: {
            ...(connection.metadata ||
              {}),

            last_sync_at:
              new Date().toISOString(),

            sync_error:
              message,
          },

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          connection.id
        )

      return res
        .status(502)
        .json({
          error:
            message,
          code:
            'META_TOKEN_INVALID',
          provider,
        })
    }

    const metadataBase =
      connection.metadata &&
      typeof connection.metadata ===
        'object'
        ? connection.metadata
        : {}

    /* ---------------------------- Discovery ------------------------------- */

    let discovery: any = null

    if (provider === 'facebook') {
      discovery =
        await discoverFacebookData(
          token
        )
    }

    if (provider === 'instagram') {
      discovery =
        await discoverInstagramData(
          token
        )
    }

    if (provider === 'whatsapp') {
      discovery =
        await discoverWhatsAppData(
          token
        )
    }

    /* -------------------------- Build metadata ---------------------------- */

    let connectionUpdate: Record<
      string,
      any
    > = {
      status:
        'connected',

      updated_at:
        new Date().toISOString(),

      metadata: {
        ...metadataBase,

        last_sync_at:
          new Date().toISOString(),

        sync_error:
          null,

        provider,

        ready_for_messaging:
          false,
      },
    }

    if (provider === 'facebook') {
      connectionUpdate.metadata = {
        ...metadataBase,

        last_sync_at:
          new Date().toISOString(),

        sync_error:
          null,

        provider,

        page_count:
          discovery.page_count,

        pages:
          discovery.pages.map(
            (page: any) => ({
              id: page.id,
              name: page.name,
              category:
                page.category,
              access_token_available:
                page.access_token_available,
            })
          ),

        ready_for_messaging:
          discovery.ready_for_messaging,
      }
    }

    if (provider === 'instagram') {
      connectionUpdate.metadata = {
        ...metadataBase,

        last_sync_at:
          new Date().toISOString(),

        sync_error:
          null,

        provider,

        account_count:
          discovery.account_count,

        instagram_accounts:
          discovery.accounts,

        ready_for_messaging:
          discovery.ready_for_messaging,
      }
    }

    if (provider === 'whatsapp') {
      connectionUpdate = {
        ...connectionUpdate,

        business_id:
          discovery.businessId,

        waba_id:
          discovery.wabaId,

        phone_number_id:
          discovery.phoneNumberId,

        display_phone_number:
          discovery.displayPhoneNumber,

        verified_name:
          discovery.verifiedName,

        metadata: {
          ...metadataBase,

          last_sync_at:
            new Date().toISOString(),

          sync_error:
            discovery.discoveryErrors
              .length > 0
              ? discovery.discoveryErrors.join(
                  ' | '
                )
              : null,

          provider,

          business_name:
            discovery.businessName,

          waba_name:
            discovery.wabaName,

          ready_for_messaging:
            discovery.readyForMessaging,

          discovery_errors:
            discovery.discoveryErrors,
        },
      }
    }

    /* -------------------------- Save connection --------------------------- */

    const {
      data: updatedConnection,
      error:
        updateConnectionError,
    } =
      await admin
        .from(
          'meta_connections'
        )
        .update(
          connectionUpdate
        )
        .eq(
          'id',
          connection.id
        )
        .select(
          'id,organization_id,provider,status,meta_user_id,business_id,waba_id,phone_number_id,display_phone_number,verified_name,metadata,token_expires_at,updated_at'
        )
        .single()

    if (
      updateConnectionError
    ) {
      console.error(
        'Meta sync connection update error:',
        updateConnectionError
      )

      return res
        .status(500)
        .json({
          error:
            'Unable to save Meta resource discovery',
          code:
            'META_CONNECTION_UPDATE_FAILED',
        })
    }

    /* ------------------------- Sync integrations -------------------------- */

    const integrationMetadata =
      {
        provider,

        meta_user_id:
          metaUserId,

        last_sync_at:
          new Date().toISOString(),

        ready_for_messaging:
          Boolean(
            connectionUpdate
              .metadata
              ?.ready_for_messaging
          ),
      } as Record<
        string,
        any
      >

    if (
      provider === 'facebook'
    ) {
      integrationMetadata.pages =
        discovery.pages
    }

    if (
      provider === 'instagram'
    ) {
      integrationMetadata.instagram_accounts =
        discovery.accounts
    }

    if (
      provider === 'whatsapp'
    ) {
      integrationMetadata.business_id =
        discovery.businessId

      integrationMetadata.waba_id =
        discovery.wabaId

      integrationMetadata.phone_number_id =
        discovery.phoneNumberId

      integrationMetadata.display_phone_number =
        discovery.displayPhoneNumber

      integrationMetadata.verified_name =
        discovery.verifiedName

      integrationMetadata.business_name =
        discovery.businessName

      integrationMetadata.waba_name =
        discovery.wabaName

      integrationMetadata.discovery_errors =
        discovery.discoveryErrors
    }

    const {
      error:
        integrationError,
    } =
      await admin
        .from(
          'integrations'
        )
        .upsert(
          {
            organization_id:
              organizationId,

            provider,

            connected:
              true,

            status:
              'connected',

            last_verified_at:
              new Date().toISOString(),

            error_message:
              null,

            metadata:
              integrationMetadata,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              'organization_id,provider',
          }
        )

    if (
      integrationError
    ) {
      console.error(
        'Meta integration sync error:',
        integrationError
      )

      return res
        .status(500)
        .json({
          error:
            'Meta connection synced but integration status could not be updated',
          code:
            'META_INTEGRATION_UPDATE_FAILED',
        })
    }

    /* ------------------------------- Result -------------------------------- */

    return res
      .status(200)
      .json({
        success: true,

        provider,

        status:
          'connected',

        ready_for_messaging:
          Boolean(
            connectionUpdate
              .metadata
              ?.ready_for_messaging
          ),

        connection:
          updatedConnection,

        discovery:
          provider === 'facebook'
            ? {
                page_count:
                  discovery.page_count,

                pages:
                  discovery.pages.map(
                    (page: any) => ({
                      id:
                        page.id,
                      name:
                        page.name,
                      category:
                        page.category,
                      access_token_available:
                        page.access_token_available,
                    })
                  ),
              }
            : provider ===
              'instagram'
            ? {
                account_count:
                  discovery.account_count,

                accounts:
                  discovery.accounts,
              }
            : {
                business_id:
                  discovery.businessId,

                waba_id:
                  discovery.wabaId,

                phone_number_id:
                  discovery.phoneNumberId,

                display_phone_number:
                  discovery.displayPhoneNumber,

                verified_name:
                  discovery.verifiedName,

                discovery_errors:
                  discovery.discoveryErrors,
              },
      })
  } catch (error) {
    console.error(
      'Meta resource sync error:',
      error
    )

    return res
      .status(500)
      .json({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to sync Meta resources',

        code:
          'META_RESOURCE_SYNC_FAILED',
      })
  }
}
