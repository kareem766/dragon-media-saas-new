import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

function env(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    )
  }

  return value
}

function normalizePhone(
  value: string | null | undefined,
): string {
  return String(value || '').replace(/\D/g, '')
}

function verifySignature(
  rawBody: string,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith('sha256=')) {
    return false
  }

  const expected = createHmac(
    'sha256',
    appSecret,
  )
    .update(rawBody, 'utf8')
    .digest('hex')

  const received =
    signature.slice('sha256='.length)

  if (
    received.length !==
    expected.length
  ) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected),
  )
}

async function getRawBody(
  req: VercelRequest,
): Promise<string> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    )
  }

  return Buffer.concat(chunks).toString(
    'utf8',
  )
}

function getSupabase() {
  return createClient(
    env('VITE_SUPABASE_URL'),
    env('SUPABASE_SECRET_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

async function sleep(
  milliseconds: number,
): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  )
}

async function findOutboundMessage(
  supabase: ReturnType<typeof getSupabase>,
  externalId: string,
  organizationId: string,
) {
  const delays = [0, 250, 750, 1500]

  for (const delay of delays) {
    if (delay > 0) {
      await sleep(delay)
    }

    const {
      data: message,
      error: messageError,
    } = await supabase
      .from('messages')
      .select(
        `
          id,
          conversation_id,
          metadata,
          delivered_at,
          read_at
        `,
      )
      .eq(
        'external_id',
        externalId,
      )
      .maybeSingle()

    if (messageError) {
      console.error(
        'WhatsApp webhook: outbound message lookup failed',
        messageError,
      )

      continue
    }

    if (!message) {
      continue
    }

    const {
      data: conversation,
      error:
        conversationError,
    } = await supabase
      .from('conversations')
      .select(
        'id, organization_id, channel',
      )
      .eq(
        'id',
        message.conversation_id,
      )
      .maybeSingle()

    if (conversationError) {
      console.error(
        'WhatsApp webhook: conversation ownership lookup failed',
        conversationError,
      )

      continue
    }

    if (
      !conversation ||
      conversation.organization_id !==
        organizationId ||
      conversation.channel !==
        'whatsapp'
    ) {
      console.warn(
        'WhatsApp webhook: message organization mismatch',
        {
          externalId,
          organizationId,
          conversationOrganizationId:
            conversation?.organization_id ||
            null,
        },
      )

      return null
    }

    return message
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

  const verifyToken =
    env('META_WHATSAPP_VERIFY_TOKEN')

  /*
   * =========================================================
   * META WEBHOOK VERIFICATION
   * =========================================================
   */

  if (req.method === 'GET') {
    const mode =
      req.query['hub.mode']

    const token =
      req.query['hub.verify_token']

    const challenge =
      req.query['hub.challenge']

    if (
      mode === 'subscribe' &&
      token === verifyToken &&
      typeof challenge === 'string'
    ) {
      return res
        .status(200)
        .send(challenge)
    }

    return res
      .status(403)
      .send('Forbidden')
  }

  /*
   * =========================================================
   * ONLY POST IS ACCEPTED
   * =========================================================
   */

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        error: 'Method not allowed',
      })
  }

  try {
    /*
     * =======================================================
     * RAW BODY
     * =======================================================
     */

    const rawBody =
      await getRawBody(req)

    /*
     * =======================================================
     * META SIGNATURE
     * =======================================================
     */

    const signature = String(
      req.headers[
        'x-hub-signature-256'
      ] || '',
    )

    if (
      !verifySignature(
        rawBody,
        signature,
        env('META_APP_SECRET'),
      )
    ) {
      console.error(
        'WhatsApp webhook: invalid Meta signature',
      )

      return res
        .status(401)
        .json({
          error:
            'Invalid webhook signature',
        })
    }

    /*
     * =======================================================
     * PARSE PAYLOAD
     * =======================================================
     */

    let payload: any

    try {
      payload =
        JSON.parse(rawBody)
    } catch (error) {
      console.error(
        'WhatsApp webhook: invalid JSON payload',
        error,
      )

      return res
        .status(400)
        .json({
          error:
            'Invalid JSON payload',
        })
    }

    if (
      payload?.object !==
      'whatsapp_business_account'
    ) {
      return res
        .status(200)
        .json({
          received: true,
          ignored: true,
        })
    }

    const supabase =
      getSupabase()

    /*
     * =======================================================
     * PROCESS ENTRIES
     * =======================================================
     */

    for (
      const entry of
        Array.isArray(
          payload?.entry,
        )
          ? payload.entry
          : []
    ) {
      for (
        const change of
          Array.isArray(
            entry?.changes,
          )
            ? entry.changes
            : []
      ) {
        if (
          change?.field !==
          'messages'
        ) {
          continue
        }

        const value =
          change?.value

        const phoneNumberId =
          String(
            value?.metadata
              ?.phone_number_id ||
              '',
          )

        if (!phoneNumberId) {
          continue
        }

        /*
         * ===================================================
         * FIND WHATSAPP CONNECTION
         * ===================================================
         */

        const {
          data: connection,
          error:
            connectionError,
        } = await supabase
          .from(
            'meta_connections',
          )
          .select(
            `
              id,
              organization_id,
              waba_id,
              phone_number_id
            `,
          )
          .eq(
            'provider',
            'whatsapp',
          )
          .eq(
            'phone_number_id',
            phoneNumberId,
          )
          .maybeSingle()

        if (connectionError) {
          console.error(
            'WhatsApp webhook: connection lookup failed',
            connectionError,
          )

          continue
        }

        if (
          !connection?.organization_id
        ) {
          console.warn(
            'WhatsApp webhook: no connection found',
            phoneNumberId,
          )

          continue
        }

        /*
         * ===================================================
         * DELIVERY / READ / FAILED STATUSES
         * ===================================================
         */

        const statuses =
          Array.isArray(
            value?.statuses,
          )
            ? value.statuses
            : []

        for (
          const status of statuses
        ) {
          const externalId =
            String(
              status?.id || '',
            )

          const deliveryStatus =
            String(
              status?.status || '',
            ).toLowerCase()

          if (
            !externalId ||
            !deliveryStatus
          ) {
            continue
          }

          const timestamp =
            status?.timestamp
              ? new Date(
                  Number(
                    status.timestamp,
                  ) * 1000,
                ).toISOString()
              : null

          const matchedMessage =
            await findOutboundMessage(
              supabase,
              externalId,
              connection.organization_id,
            )

          if (
            !matchedMessage?.id
          ) {
            console.warn(
              'WhatsApp webhook: no outbound message found for status',
              {
                externalId,
                deliveryStatus,
                organizationId:
                  connection.organization_id,
              },
            )

            continue
          }

          const existingMetadata =
            matchedMessage.metadata &&
            typeof matchedMessage.metadata ===
              'object'
              ? matchedMessage.metadata
              : {}

          const statusMetadata = {
            ...existingMetadata,

            whatsapp_delivery_status:
              deliveryStatus,

            whatsapp_status_timestamp:
              status?.timestamp ||
              null,

            whatsapp_recipient_id:
              status?.recipient_id ||
              null,

            ...(deliveryStatus ===
            'failed'
              ? {
                  whatsapp_delivery_errors:
                    Array.isArray(
                      status?.errors,
                    )
                      ? status.errors
                      : [],
                }
              : {}),
          }

          const updateData: Record<
            string,
            unknown
          > = {
            metadata:
              statusMetadata,
          }

          /*
           * Keep the dedicated timestamp columns
           * synchronized with Meta status.
           */

          if (
            deliveryStatus ===
              'delivered' &&
            !matchedMessage.delivered_at
          ) {
            updateData.delivered_at =
              timestamp ||
              new Date().toISOString()
          }

          if (
            deliveryStatus === 'read' &&
            !matchedMessage.read_at
          ) {
            updateData.read_at =
              timestamp ||
              new Date().toISOString()
          }

          const {
            error:
              statusUpdateError,
          } = await supabase
            .from('messages')
            .update(updateData)
            .eq(
              'id',
              matchedMessage.id,
            )

          if (statusUpdateError) {
            console.error(
              'WhatsApp webhook: status update failed',
              statusUpdateError,
            )
          } else {
            console.log(
              'WhatsApp webhook: status saved',
              {
                externalId,
                deliveryStatus,
                messageId:
                  matchedMessage.id,
              },
            )
          }
        }

        /*
         * ===================================================
         * INCOMING CUSTOMER MESSAGES
         * ===================================================
         */

        const contacts =
          Array.isArray(
            value?.contacts,
          )
            ? value.contacts
            : []

        const messages =
          Array.isArray(
            value?.messages,
          )
            ? value.messages
            : []

        for (
          const message of messages
        ) {
          const waId =
            String(
              message?.from ||
                contacts?.[0]
                  ?.wa_id ||
                '',
            )

          if (!waId) {
            continue
          }

          const profileName =
            typeof contacts?.[0]
              ?.profile?.name ===
            'string'
              ? contacts[0]
                  .profile.name
              : null

          /*
           * =================================================
           * MESSAGE CONTENT
           * =================================================
           */

          let content = ''

          if (
            message?.type ===
            'text'
          ) {
            content = String(
              message?.text
                ?.body || '',
            )
          } else if (
            message?.type ===
            'button'
          ) {
            content = String(
              message?.button
                ?.text || '',
            )
          } else if (
            message?.type ===
            'interactive'
          ) {
            content = String(
              message
                ?.interactive
                ?.button_reply
                ?.title ||
                message
                  ?.interactive
                  ?.list_reply
                  ?.title ||
                '',
            )
          }

          if (!content) {
            content =
              `[WhatsApp ${String(
                message?.type ||
                  'message',
              )}]`
          }

          /*
           * =================================================
           * CUSTOMER
           * =================================================
           */

          const normalizedPhone =
            normalizePhone(waId)

          let customerId:
            | string
            | null = null

          const {
            data:
              existingCustomer,
          } = await supabase
            .from('customers')
            .select('id')
            .eq(
              'organization_id',
              connection.organization_id,
            )
            .eq(
              'phone',
              waId,
            )
            .maybeSingle()

          if (
            existingCustomer?.id
          ) {
            customerId =
              existingCustomer.id
          } else if (
            normalizedPhone
          ) {
            const {
              data:
                phoneCustomer,
            } = await supabase
              .from('customers')
              .select('id')
              .eq(
                'organization_id',
                connection.organization_id,
              )
              .eq(
                'phone',
                normalizedPhone,
              )
              .maybeSingle()

            customerId =
              phoneCustomer?.id ||
              null
          }

          if (!customerId) {
            const {
              data:
                createdCustomer,
              error,
            } = await supabase
              .from('customers')
              .insert({
                organization_id:
                  connection.organization_id,

                name:
                  profileName ||
                  waId,

                phone:
                  waId,

                source:
                  'whatsapp',
              })
              .select('id')
              .single()

            if (error) {
              console.error(
                'WhatsApp webhook: customer insert failed',
                error,
              )

              continue
            }

            customerId =
              createdCustomer?.id ||
              null
          }

          if (!customerId) {
            continue
          }

          /*
           * =================================================
           * CONVERSATION METADATA
           * =================================================
           */

          const incomingMetadata = {
            provider:
              'whatsapp',

            phone_number_id:
              phoneNumberId,

            waba_id:
              connection.waba_id,

            wa_id:
              waId,

            message_type:
              message?.type ||
              null,

            timestamp:
              message?.timestamp ||
              null,
          }

          /*
           * =================================================
           * CONVERSATION
           * =================================================
           */

          let conversationId:
            | string
            | null = null

          const {
            data:
              existingConversation,
          } = await supabase
            .from(
              'conversations',
            )
            .select(
              `
                id,
                unread_count,
                metadata
              `,
            )
            .eq(
              'organization_id',
              connection.organization_id,
            )
            .eq(
              'channel',
              'whatsapp',
            )
            .eq(
              'customer_id',
              customerId,
            )
            .maybeSingle()

          if (
            existingConversation?.id
          ) {
            conversationId =
              existingConversation.id

            const existingConversationMetadata =
              existingConversation.metadata &&
              typeof existingConversation.metadata ===
                'object'
                ? existingConversation.metadata
                : {}

            await supabase
              .from(
                'conversations',
              )
              .update({
                last_message_at:
                  new Date()
                    .toISOString(),

                updated_at:
                  new Date()
                    .toISOString(),

                unread_count:
                  Number(
                    existingConversation
                      .unread_count ||
                      0,
                  ) + 1,

                metadata: {
                  ...existingConversationMetadata,
                  ...incomingMetadata,
                },
              })
              .eq(
                'id',
                conversationId,
              )
          } else {
            const {
              data:
                createdConversation,
              error,
            } = await supabase
              .from(
                'conversations',
              )
              .insert({
                organization_id:
                  connection.organization_id,

                customer_id:
                  customerId,

                channel:
                  'whatsapp',

                handled_by:
                  'ai',

                last_message_at:
                  new Date()
                    .toISOString(),

                status:
                  'open',

                subject:
                  profileName ||
                  waId,

                unread_count:
                  1,

                metadata:
                  incomingMetadata,
              })
              .select('id')
              .single()

            if (error) {
              console.error(
                'WhatsApp webhook: conversation insert failed',
                error,
              )

              continue
            }

            conversationId =
              createdConversation?.id ||
              null
          }

          if (!conversationId) {
            continue
          }

          /*
           * =================================================
           * DUPLICATE PROTECTION
           * =================================================
           */

          const externalId =
            String(
              message?.id || '',
            ) || null

          if (externalId) {
            const {
              data: duplicate,
            } = await supabase
              .from('messages')
              .select('id')
              .eq(
                'external_id',
                externalId,
              )
              .maybeSingle()

            if (duplicate?.id) {
              console.log(
                'WhatsApp webhook: duplicate message ignored',
                {
                  externalId,
                },
              )

              continue
            }
          }

          /*
           * =================================================
           * INSERT CUSTOMER MESSAGE
           * =================================================
           */

          const {
            error:
              messageInsertError,
          } = await supabase
            .from('messages')
            .insert({
              conversation_id:
                conversationId,

              sender_type:
                'customer',

              content,

              external_id:
                externalId,

              metadata: {
                ...incomingMetadata,

                source:
                  'whatsapp_webhook',

                received_at:
                  new Date()
                    .toISOString(),
              },
            })

          if (messageInsertError) {
            /*
             * A duplicate external_id is harmless.
             * Meta can retry webhook deliveries.
             */
            if (
              messageInsertError.code ===
              '23505'
            ) {
              console.log(
                'WhatsApp webhook: duplicate external_id ignored',
                {
                  externalId,
                },
              )
            } else {
              console.error(
                'WhatsApp webhook: message insert failed',
                messageInsertError,
              )
            }

            continue
          }

          console.log(
            'WhatsApp webhook: incoming message saved',
            {
              organizationId:
                connection.organization_id,

              conversationId,

              customerId,

              externalId,
            },
          )
        }
      }
    }

    /*
     * Always acknowledge Meta successfully
     * after processing the payload.
     *
     * This prevents unnecessary Meta retries.
     */

    return res
      .status(200)
      .json({
        received: true,
      })
  } catch (error) {
    console.error(
      'WhatsApp webhook: fatal error',
      error,
    )

    /*
     * Do not expose internal errors or secrets.
     * Return 200 to avoid an endless Meta retry loop.
     */
    return res
      .status(200)
      .json({
        received: true,
      })
  }
}
