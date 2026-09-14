import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import { createClient } from '@supabase/supabase-js'

const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v23.0'

function env(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    )
  }

  return value
}

function errorMessage(
  error: unknown,
  fallback: string,
): string {
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
      const candidate =
        value[key]

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

async function graphGet(
  path: string,
  accessToken: string,
) {
  const separator =
    path.includes('?')
      ? '&'
      : '?'

  const response =
    await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}${path}${separator}access_token=${encodeURIComponent(
        accessToken,
      )}`,
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
  const separator =
    path.includes('?')
      ? '&'
      : '?'

  const response =
    await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}${path}${separator}access_token=${encodeURIComponent(
        accessToken,
      )}`,
      {
        method: 'POST',
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader(
    'Cache-Control',
    'no-store',
  )

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        success: false,
        error: 'Method not allowed',
      })
  }

  try {
    const authorization =
      req.headers.authorization || ''

    const supabaseAccessToken =
      authorization.startsWith('Bearer ')
        ? authorization.slice(
            'Bearer '.length,
          )
        : ''

    if (!supabaseAccessToken) {
      return res
        .status(401)
        .json({
          success: false,
          error:
            'Authentication required',
        })
    }

    const body =
      req.body &&
      typeof req.body === 'object'
        ? req.body
        : {}

    const code =
      typeof body.code === 'string'
        ? body.code.trim()
        : ''

    const eventWabaId =
      typeof body.waba_id === 'string'
        ? body.waba_id.trim()
        : ''

    const eventPhoneNumberId =
      typeof body.phone_number_id ===
      'string'
        ? body.phone_number_id.trim()
        : ''

    if (!code) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'WhatsApp authorization code is missing',
          code:
            'WHATSAPP_AUTH_CODE_MISSING',
        })
    }

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
        supabaseAccessToken,
      )

    if (
      authError ||
      !authData.user
    ) {
      return res
        .status(401)
        .json({
          success: false,
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
      error:
        membershipError,
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
      throw membershipError
    }

    const organizationId =
      membership?.organization_id

    if (!organizationId) {
      return res
        .status(403)
        .json({
          success: false,
          error:
            'Organization membership not found',
        })
    }

    /*
     * Exchange the Embedded Signup
     * authorization code server-side.
     *
     * The Meta App Secret never reaches
     * the browser.
     */
    const appId =
      env('META_APP_ID')

    const appSecret =
      env('META_APP_SECRET')

    const redirectUri =
      env('META_REDIRECT_URI')

    const exchangeUrl =
      new URL(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`,
      )

    exchangeUrl.searchParams.set(
      'client_id',
      appId,
    )

    exchangeUrl.searchParams.set(
      'client_secret',
      appSecret,
    )

    exchangeUrl.searchParams.set(
      'code',
      code,
    )

    exchangeUrl.searchParams.set(
      'redirect_uri',
      redirectUri,
    )

    const exchangeResponse =
      await fetch(
        exchangeUrl.toString(),
      )

    const exchangeData =
      await exchangeResponse
        .json()
        .catch(() => null)

    if (
      !exchangeResponse.ok ||
      typeof exchangeData?.access_token !==
        'string'
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

      return res
        .status(502)
        .json({
          success: false,
          error:
            'Meta authorization code exchange failed',
          code:
            'WHATSAPP_TOKEN_EXCHANGE_FAILED',
        })
    }

    const accessToken =
      exchangeData.access_token as string

    /*
     * Validate the newly issued token.
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
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/debug_token?${debugParams.toString()}`,
      )

    const debugData =
      await debugResponse
        .json()
        .catch(() => null)

    const tokenData =
      debugData?.data

    if (
      !debugResponse.ok ||
      tokenData?.is_valid !== true
    ) {
      return res
        .status(502)
        .json({
          success: false,
          error:
            'Meta returned an invalid WhatsApp access token',
          code:
            'WHATSAPP_TOKEN_INVALID',
        })
    }

    const scopes =
      Array.isArray(
        tokenData?.scopes,
      )
        ? tokenData.scopes
        : []

    const hasManagementPermission =
      scopes.includes(
        'whatsapp_business_management',
      )

    const hasMessagingPermission =
      scopes.includes(
        'whatsapp_business_messaging',
      )

    if (
      !hasManagementPermission ||
      !hasMessagingPermission
    ) {
      return res
        .status(403)
        .json({
          success: false,
          error:
            'WhatsApp Embedded Signup configuration is missing the required WhatsApp permissions.',
          code:
            'WHATSAPP_REQUIRED_PERMISSIONS_MISSING',
          required_permissions: [
            'whatsapp_business_management',
            'whatsapp_business_messaging',
          ],
        })
    }

    /*
     * Prefer WABA ID supplied by the
     * Embedded Signup session event.
     */
    let wabaId =
      eventWabaId || null

    /*
     * If Meta did not send it in the
     * browser event, use granular scopes.
     */
    if (!wabaId) {
      const granularScopes =
        Array.isArray(
          tokenData?.granular_scopes,
        )
          ? tokenData.granular_scopes
          : []

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

        const item =
          scope as {
            scope?: unknown
            target_ids?: unknown
          }

        if (
          item.scope ===
            'whatsapp_business_management' &&
          Array.isArray(
            item.target_ids,
          )
        ) {
          const first =
            item.target_ids.find(
              (value: unknown) =>
                typeof value ===
                  'string' &&
                value.trim(),
            )

          if (
            typeof first ===
              'string'
          ) {
            wabaId =
              first.trim()
            break
          }
        }
      }
    }

    if (!wabaId) {
      return res
        .status(422)
        .json({
          success: false,
          error:
            'Meta did not return a WhatsApp Business Account ID.',
          code:
            'WHATSAPP_WABA_ID_MISSING',
        })
    }

    /*
     * Verify the WABA belongs to
     * the newly issued Meta token.
     */
    const {
      response:
        wabaResponse,
      data:
        wabaData,
    } =
      await graphGet(
        `/${encodeURIComponent(
          wabaId,
        )}?fields=id,name,owner_business_info`,
        accessToken,
      )

    if (
      !wabaResponse.ok ||
      wabaData?.id !==
        wabaId
    ) {
      console.error(
        'WhatsApp WABA validation failed:',
        {
          wabaId,
          status:
            wabaResponse.status,
          error:
            wabaData?.error,
        },
      )

      return res
        .status(403)
        .json({
          success: false,
          error:
            'The selected WhatsApp Business Account could not be verified.',
          code:
            'WHATSAPP_WABA_VALIDATION_FAILED',
        })
    }

    /*
     * Find the phone number.
     */
    const {
      response:
        phoneResponse,
      data:
        phoneData,
    } =
      await graphGet(
        `/${encodeURIComponent(
          wabaId,
        )}/phone_numbers?fields=id,display_phone_number,verified_name,name_status`,
        accessToken,
      )

    if (
      !phoneResponse.ok ||
      !Array.isArray(
        phoneData?.data,
      )
    ) {
      return res
        .status(502)
        .json({
          success: false,
          error:
            'Unable to load WhatsApp phone numbers.',
          code:
            'WHATSAPP_PHONE_DISCOVERY_FAILED',
        })
    }

    const phoneNumbers =
      phoneData.data as Array<
        Record<string, unknown>
      >

    const selectedPhone =
      eventPhoneNumberId
        ? phoneNumbers.find(
            (phone) =>
              phone.id ===
              eventPhoneNumberId,
          )
        : phoneNumbers[0]

    if (!selectedPhone) {
      return res
        .status(422)
        .json({
          success: false,
          error:
            'No WhatsApp phone number was returned for this WABA.',
          code:
            'WHATSAPP_PHONE_NUMBER_MISSING',
        })
    }

    const phoneNumberId =
      String(
        selectedPhone.id,
      )

    const displayPhoneNumber =
      typeof selectedPhone
        .display_phone_number ===
      'string'
        ? selectedPhone.display_phone_number
        : null

    const verifiedName =
      typeof selectedPhone
        .verified_name ===
      'string'
        ? selectedPhone.verified_name
        : null

    /*
     * Subscribe the WABA to the app.
     */
    const {
      response:
        subscribeResponse,
      data:
        subscribeData,
    } =
      await graphPost(
        `/${encodeURIComponent(
          wabaId,
        )}/subscribed_apps`,
        accessToken,
      )

    const webhookSubscribed =
      subscribeResponse.ok

    if (
      !webhookSubscribed
    ) {
      console.error(
        'WhatsApp WABA webhook subscription failed:',
        {
          wabaId,
          status:
            subscribeResponse.status,
          error:
            subscribeData?.error,
        },
      )
    }

    const readyForMessaging =
      Boolean(
        wabaId &&
          phoneNumberId &&
          webhookSubscribed,
      )

    /*
     * Store the encrypted/secret token
     * only in meta_connections.access_token.
     * Never place it in metadata.
     */
    const {
      data:
        existingConnection,
      error:
        existingConnectionError,
    } =
      await adminSupabase
        .from('meta_connections')
        .select(
          'id',
        )
        .eq(
          'organization_id',
          organizationId,
        )
        .eq(
          'provider',
          'whatsapp',
        )
        .order(
          'updated_at',
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle()

    if (
      existingConnectionError
    ) {
      throw existingConnectionError
    }

    const tokenExpiresIn =
      Number(
        exchangeData?.expires_in ||
          0,
      )

    const tokenExpiresAt =
      tokenExpiresIn > 0
        ? new Date(
            Date.now() +
              tokenExpiresIn *
                1000,
          ).toISOString()
        : null

    const metadata = {
      ...(existingConnection
        ? {}
        : {}),
      whatsapp_webhook_subscribed:
        webhookSubscribed,
      ready_for_messaging:
        readyForMessaging,
      waba_name:
        typeof wabaData?.name ===
        'string'
          ? wabaData.name
          : null,
      owner_business_id:
        typeof wabaData
          ?.owner_business_info
          ?.id === 'string'
          ? wabaData
              .owner_business_info.id
          : null,
      last_completed_at:
        new Date().toISOString(),
    }

    if (
      existingConnection?.id
    ) {
      const {
        error:
          updateConnectionError,
      } =
        await adminSupabase
          .from('meta_connections')
          .update({
            access_token:
              accessToken,
            token_expires_at:
              tokenExpiresAt,
            meta_user_id:
              typeof tokenData?.user_id ===
              'string'
                ? tokenData.user_id
                : null,
            business_id:
              typeof wabaData
                ?.owner_business_info
                ?.id === 'string'
                ? wabaData
                    .owner_business_info
                    .id
                : null,
            waba_id:
              wabaId,
            phone_number_id:
              phoneNumberId,
            display_phone_number:
              displayPhoneNumber,
            verified_name:
              verifiedName,
            status:
              readyForMessaging
                ? 'connected'
                : 'error',
            metadata,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            existingConnection.id,
          )

      if (
        updateConnectionError
      ) {
        throw updateConnectionError
      }
    } else {
      const {
        error:
          insertConnectionError,
      } =
        await adminSupabase
          .from('meta_connections')
          .insert({
            organization_id:
              organizationId,
            provider:
              'whatsapp',
            access_token:
              accessToken,
            token_expires_at:
              tokenExpiresAt,
            meta_user_id:
              typeof tokenData?.user_id ===
              'string'
                ? tokenData.user_id
                : null,
            business_id:
              typeof wabaData
                ?.owner_business_info
                ?.id === 'string'
                ? wabaData
                    .owner_business_info
                    .id
                : null,
            waba_id:
              wabaId,
            phone_number_id:
              phoneNumberId,
            display_phone_number:
              displayPhoneNumber,
            verified_name:
              verifiedName,
            status:
              readyForMessaging
                ? 'connected'
                : 'error',
            metadata,
          })

      if (
        insertConnectionError
      ) {
        throw insertConnectionError
      }
    }

    /*
     * Keep integrations as the UI-facing
     * connection state.
     */
    const {
      data:
        existingIntegration,
      error:
        integrationLookupError,
    } =
      await adminSupabase
        .from('integrations')
        .select(
          'id',
        )
        .eq(
          'organization_id',
          organizationId,
        )
        .eq(
          'provider',
          'whatsapp',
        )
        .maybeSingle()

    if (
      integrationLookupError
    ) {
      throw integrationLookupError
    }

    const integrationPayload = {
      organization_id:
        organizationId,
      provider:
        'whatsapp',
      connected:
        readyForMessaging,
      status:
        readyForMessaging
          ? 'connected'
          : 'error',
      connected_at:
        new Date().toISOString(),
      last_verified_at:
        new Date().toISOString(),
      error_message:
        readyForMessaging
          ? null
          : 'WhatsApp connection is authenticated but webhook messaging is not ready.',
      metadata: {
        waba_id:
          wabaId,
        phone_number_id:
          phoneNumberId,
        display_phone_number:
          displayPhoneNumber,
        verified_name:
          verifiedName,
        whatsapp_webhook_subscribed:
          webhookSubscribed,
        ready_for_messaging:
          readyForMessaging,
      },
      updated_at:
        new Date().toISOString(),
    }

    if (
      existingIntegration?.id
    ) {
      const {
        error:
          integrationUpdateError,
      } =
        await adminSupabase
          .from('integrations')
          .update(
            integrationPayload,
          )
          .eq(
            'id',
            existingIntegration.id,
          )

      if (
        integrationUpdateError
      ) {
        throw integrationUpdateError
      }
    } else {
      const {
        error:
          integrationInsertError,
      } =
        await adminSupabase
          .from('integrations')
          .insert(
            integrationPayload,
          )

      if (
        integrationInsertError
      ) {
        throw integrationInsertError
      }
    }

    if (!readyForMessaging) {
      return res
        .status(502)
        .json({
          success: false,
          error:
            'WhatsApp was authorized, but webhook subscription failed.',
          code:
            'WHATSAPP_WEBHOOK_SUBSCRIPTION_FAILED',
          waba_id:
            wabaId,
          phone_number_id:
            phoneNumberId,
        })
    }

    return res
      .status(200)
      .json({
        success: true,
        provider:
          'whatsapp',
        waba_id:
          wabaId,
        phone_number_id:
          phoneNumberId,
        display_phone_number:
          displayPhoneNumber,
        verified_name:
          verifiedName,
        webhook_subscribed:
          true,
        ready_for_messaging:
          true,
      })
  } catch (error) {
    console.error(
      'WhatsApp Embedded Signup completion error:',
      error,
    )

    return res
      .status(500)
      .json({
        success: false,
        error: errorMessage(
          error,
          'Unable to complete WhatsApp Embedded Signup.',
        ),
        code:
          'WHATSAPP_EMBEDDED_SIGNUP_FAILED',
      })
  }
}
