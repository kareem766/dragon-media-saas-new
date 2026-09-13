import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function env(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function verifySignature(
  rawBody: string,
  signature: string,
  appSecret: string,
) {
  if (!signature.startsWith('sha256=')) {
    return false
  }

  const expected = createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const received = signature.slice('sha256='.length)

  if (received.length !== expected.length) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected),
  )
}

function normalizePhone(
  value: string | null | undefined,
) {
  return String(value || '').replace(/\D/g, '')
}

function getRawBody(req: VercelRequest) {
  if (typeof req.body === 'string') {
    return req.body
  }

  return JSON.stringify(req.body ?? {})
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Cache-Control', 'no-store')

  /*
   * ---------------------------------------------------------
   * META WEBHOOK VERIFICATION
   * ---------------------------------------------------------
   */

  const verifyToken =
    env('META_WHATSAPP_VERIFY_TOKEN')

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
   * ---------------------------------------------------------
   * ONLY POST IS ACCEPTED AFTER VERIFICATION
   * ---------------------------------------------------------
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
     * -------------------------------------------------------
     * VERIFY META SIGNATURE
     * -------------------------------------------------------
     */

    const rawBody =
      getRawBody(req)

    const signature =
      String(
        req.headers[
          'x-hub-signature-256'
        ] || '',
      )

    const validSignature =
      verifySignature(
        rawBody,
        signature,
        env('META_APP_SECRET'),
      )

    if (!validSignature) {
      return res
        .status(401)
        .json({
          error:
            'Invalid webhook signature',
        })
    }

    /*
     * -------------------------------------------------------
     * PARSE PAYLOAD
     * -------------------------------------------------------
     */

    const payload =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body

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

    /*
     * -------------------------------------------------------
     * SERVER-SIDE SUPABASE CLIENT
     * -------------------------------------------------------
     */

    const supabase =
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

    /*
     * -------------------------------------------------------
     * PROCESS META ENTRIES
     * -------------------------------------------------------
     */

    for (
      const entry of
        payload?.entry || []
    ) {
      const changes =
        Array.isArray(
          entry?.changes,
        )
          ? entry.changes
          : []

      for (
        const change of changes
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
         * ---------------------------------------------------
         * FIND CONNECTED DRAGON MEDIA WHATSAPP
         * ---------------------------------------------------
         */

        const {
          data: connection,
        } = await supabase
          .from('meta_connections')
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

        if (
          !connection
            ?.organization_id
        ) {
          console.warn(
            'WhatsApp webhook: no Dragon Media connection found for phone number',
            phoneNumberId,
          )

          continue
        }

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

        /*
         * ---------------------------------------------------
         * PROCESS INCOMING MESSAGES
         * ---------------------------------------------------
         */

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
           * -----------------------------------------------
           * EXTRACT MESSAGE CONTENT
           * -----------------------------------------------
           */

          let content = ''

          if (
            message?.type ===
            'text'
          ) {
            content =
              String(
                message?.text
                  ?.body || '',
              )
          } else if (
            message?.type ===
            'button'
          ) {
            content =
              String(
                message?.button
                  ?.text || '',
              )
          } else if (
            message?.type ===
            'interactive'
          ) {
            content =
              String(
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
           * -----------------------------------------------
           * FIND OR CREATE CUSTOMER
           * -----------------------------------------------
           */

          const normalizedPhone =
            normalizePhone(
              waId,
            )

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
              connection
                .organization_id,
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
                connection
                  .organization_id,
              )
              .eq(
                'phone',
                normalizedPhone,
              )
              .maybeSingle()

            if (
              phoneCustomer?.id
            ) {
              customerId =
                phoneCustomer.id
            }
          }

          if (!customerId) {
            const {
              data:
                createdCustomer,
            } = await supabase
              .from('customers')
              .insert({
                organization_id:
                  connection
                    .organization_id,

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

            customerId =
              createdCustomer
                ?.id || null
          }

          if (!customerId) {
            continue
          }

          /*
           * -----------------------------------------------
           * MESSAGE METADATA
           * -----------------------------------------------
           */

          const metadata = {
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
           * -----------------------------------------------
           * FIND OR CREATE CONVERSATION
           * -----------------------------------------------
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
              'id, unread_count',
            )
            .eq(
              'organization_id',
              connection
                .organization_id,
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

                metadata,
              })
              .eq(
                'id',
                conversationId,
              )
          } else {
            const {
              data:
                createdConversation,
            } = await supabase
              .from(
                'conversations',
              )
              .insert({
                organization_id:
                  connection
                    .organization_id,

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

                metadata,
              })
              .select('id')
              .single()

            conversationId =
              createdConversation
                ?.id || null
          }

          if (!conversationId) {
            continue
          }

          /*
           * -----------------------------------------------
           * PREVENT DUPLICATE META MESSAGES
           * -----------------------------------------------
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
              continue
            }
          }

          /*
           * -----------------------------------------------
           * SAVE MESSAGE
           * -----------------------------------------------
           */

          await supabase
            .from('messages')
            .insert({
              conversation_id:
                conversationId,

              sender_type:
                'customer',

              content,

              external_id:
                externalId,

              metadata,
            })
        }
      }
    }

    /*
     * -------------------------------------------------------
     * ACKNOWLEDGE META
     * -------------------------------------------------------
     */

    return res
      .status(200)
      .json({
        received: true,
      })
  } catch (error) {
    console.error(
      'WhatsApp webhook error:',
      error,
    )

    /*
     * Meta should receive an acknowledgement
     * to avoid unnecessary webhook retries.
     */

    return res
      .status(200)
      .json({
        received: true,
      })
  }
}
