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

type MetaProvider =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'

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

/*
 * =========================================================
 * COMMON HELPERS
 * =========================================================
 */

function getObjectValue(
  source: unknown,
  keys: string[],
): unknown {
  if (
    !source ||
    typeof source !== 'object'
  ) {
    return null
  }

  const object =
    source as Record<
      string,
      unknown
    >

  for (const key of keys) {
    const value = object[key]

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value
    }
  }

  return null
}

function getNestedObjectValue(
  source: unknown,
  keys: string[],
): unknown {
  if (
    !source ||
    typeof source !== 'object'
  ) {
    return null
  }

  const object =
    source as Record<
      string,
      unknown
    >

  const metadata =
    object.metadata

  if (
    metadata &&
    typeof metadata === 'object'
  ) {
    const metadataObject =
      metadata as Record<
        string,
        unknown
      >

    for (const key of keys) {
      const value =
        metadataObject[key]

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        return value
      }
    }
  }

  return null
}

function connectionContainsExternalId(
  connection: Record<
    string,
    unknown
  >,
  externalId: string,
): boolean {
  if (!externalId) {
    return false
  }

  const normalizedTarget =
    String(externalId).trim()

  const directKeys = [
    'page_id',
    'facebook_page_id',
    'facebook_pageId',
    'instagram_account_id',
    'instagram_business_account_id',
    'instagram_business_id',
    'business_account_id',
    'external_id',
    'external_account_id',
    'account_id',
    'meta_account_id',
  ]

  for (const key of directKeys) {
    const value =
      connection[key]

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() ===
        normalizedTarget
    ) {
      return true
    }
  }

  const nestedValue =
    getNestedObjectValue(
      connection,
      [
        'page_id',
        'facebook_page_id',
        'facebook_pageId',
        'instagram_account_id',
        'instagram_business_account_id',
        'instagram_business_id',
        'business_account_id',
        'external_id',
        'external_account_id',
        'account_id',
        'meta_account_id',
      ],
    )

  if (
    nestedValue !== null &&
    String(nestedValue).trim() ===
      normalizedTarget
  ) {
    return true
  }

  return false
}

function getSocialConnectionId(
  connection: Record<
    string,
    unknown
  >,
): string | null {
  const candidates = [
    'page_id',
    'facebook_page_id',
    'facebook_pageId',
    'instagram_account_id',
    'instagram_business_account_id',
    'instagram_business_id',
    'business_account_id',
    'external_id',
    'external_account_id',
    'account_id',
    'meta_account_id',
  ]

  const directValue =
    getObjectValue(
      connection,
      candidates,
    )

  if (
    directValue !== null
  ) {
    return String(
      directValue,
    )
  }

  const nestedValue =
    getNestedObjectValue(
      connection,
      candidates,
    )

  if (
    nestedValue !== null
  ) {
    return String(
      nestedValue,
    )
  }

  return null
}

/*
 * =========================================================
 * WHATSAPP OUTBOUND STATUS HELPERS
 * =========================================================
 */

async function findOutboundMessage(
  supabase: ReturnType<typeof getSupabase>,
  externalId: string,
  organizationId: string,
) {
  const delays = [
    0,
    250,
    750,
    1500,
  ]

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
      .limit(1)
      .maybeSingle()

    if (messageError) {
      console.error(
        'Meta webhook: outbound message lookup failed',
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
      .limit(1)
      .maybeSingle()

    if (conversationError) {
      console.error(
        'Meta webhook: conversation ownership lookup failed',
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
        'Meta webhook: outbound message organization mismatch',
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

/*
 * =========================================================
 * WHATSAPP CUSTOMER
 * =========================================================
 */

async function findCustomer(
  supabase: ReturnType<typeof getSupabase>,
  organizationId: string,
  phone: string,
) {
  const normalizedPhone =
    normalizePhone(phone)

  const {
    data: exactCustomer,
    error: exactError,
  } = await supabase
    .from('customers')
    .select(
      'id, name, phone',
    )
    .eq(
      'organization_id',
      organizationId,
    )
    .eq(
      'phone',
      phone,
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle()

  if (exactError) {
    console.error(
      'WhatsApp webhook: exact customer lookup failed',
      exactError,
    )
  }

  if (exactCustomer?.id) {
    return exactCustomer
  }

  if (!normalizedPhone) {
    return null
  }

  const {
    data: customers,
    error: normalizedError,
  } = await supabase
    .from('customers')
    .select(
      'id, name, phone',
    )
    .eq(
      'organization_id',
      organizationId,
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )

  if (normalizedError) {
    console.error(
      'WhatsApp webhook: normalized customer lookup failed',
      normalizedError,
    )

    return null
  }

  const normalizedCustomer =
    (
      customers || []
    ).find(
      (customer) =>
        normalizePhone(
          customer.phone,
        ) ===
        normalizedPhone,
    )

  return (
    normalizedCustomer ||
    null
  )
}

/*
 * =========================================================
 * CONVERSATION LOOKUP
 * =========================================================
 */

async function findConversation(
  supabase: ReturnType<typeof getSupabase>,
  organizationId: string,
  customerId: string,
  channel: MetaProvider,
) {
  const {
    data: conversation,
    error,
  } = await supabase
    .from('conversations')
    .select(
      `
        id,
        unread_count,
        metadata,
        last_message_at,
        updated_at,
        created_at
      `,
    )
    .eq(
      'organization_id',
      organizationId,
    )
    .eq(
      'channel',
      channel,
    )
    .eq(
      'customer_id',
      customerId,
    )
    .order(
      'last_message_at',
      {
        ascending: false,
        nullsFirst: false,
      },
    )
    .order(
      'updated_at',
      {
        ascending: false,
      },
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Meta webhook: conversation lookup failed',
      error,
    )

    return null
  }

  return conversation
}

async function updateConversation(
  supabase: ReturnType<typeof getSupabase>,
  conversationId: string,
  existingMetadata: unknown,
  unreadCount: number,
  incomingMetadata: Record<
    string,
    unknown
  >,
) {
  const metadata =
    existingMetadata &&
    typeof existingMetadata ===
      'object'
      ? existingMetadata
      : {}

  const now =
    new Date().toISOString()

  const {
    error,
  } = await supabase
    .from('conversations')
    .update({
      last_message_at:
        now,

      updated_at:
        now,

      unread_count:
        unreadCount + 1,

      metadata: {
        ...(metadata as Record<
          string,
          unknown
        >),

        ...incomingMetadata,
      },
    })
    .eq(
      'id',
      conversationId,
    )

  if (error) {
    console.error(
      'Meta webhook: conversation update failed',
      error,
    )

    return false
  }

  return true
}

/*
 * =========================================================
 * SOCIAL CONNECTION LOOKUP
 * =========================================================
 *
 * We intentionally select * here because existing projects
 * can contain different Meta connection fields depending on
 * which Meta provider was connected.
 *
 * No token value is logged.
 */

async function findSocialConnection(
  supabase: ReturnType<typeof getSupabase>,
  provider: 'facebook' | 'instagram',
  externalAccountId: string,
) {
  const {
    data: connections,
    error,
  } = await supabase
    .from(
      'meta_connections',
    )
    .select('*')
    .eq(
      'provider',
      provider,
    )

  if (error) {
    console.error(
      'Meta webhook: social connection lookup failed',
      {
        provider,
        error,
      },
    )

    return null
  }

  const connection =
    (
      connections || []
    ).find(
      (
        item: Record<
          string,
          unknown
        >,
      ) =>
        connectionContainsExternalId(
          item,
          externalAccountId,
        ),
    )

  return (
    connection || null
  )
}

/*
 * =========================================================
 * SOCIAL CUSTOMER
 * =========================================================
 *
 * The existing customers table already uses phone as a
 * stable external contact identifier for WhatsApp.
 *
 * For Messenger / Instagram we keep the external sender ID
 * in the same field so we do not require a schema rebuild.
 */

async function findSocialCustomer(
  supabase: ReturnType<typeof getSupabase>,
  organizationId: string,
  externalUserId: string,
) {
  const {
    data: customer,
    error,
  } = await supabase
    .from('customers')
    .select(
      'id, name, phone',
    )
    .eq(
      'organization_id',
      organizationId,
    )
    .eq(
      'phone',
      externalUserId,
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Meta webhook: social customer lookup failed',
      error,
    )

    return null
  }

  return customer
}

/*
 * =========================================================
 * SOCIAL MESSAGE CONTENT
 * =========================================================
 */

function extractSocialMessageContent(
  message: any,
): string {
  const text =
    typeof message?.message
      ?.text === 'string'
      ? message.message.text
      : ''

  if (text) {
    return text
  }

  const attachment =
    message?.message
      ?.attachments?.[0]

  if (
    attachment?.type
  ) {
    const attachmentType =
      String(
        attachment.type,
      )

    const title =
      typeof attachment
        ?.payload?.title ===
      'string'
        ? attachment.payload
            .title
        : ''

    if (title) {
      return title
    }

    return `[${attachmentType}]`
  }

  if (
    typeof message?.message
      ?.quick_reply
      ?.payload === 'string'
  ) {
    return String(
      message.message
        .quick_reply.payload,
    )
  }

  return '[Meta message]'
}

/*
 * =========================================================
 * SOCIAL CUSTOMER NAME
 * =========================================================
 */

function getSocialCustomerName(
  message: any,
): string {
  const sender =
    message?.sender

  const profile =
    message?.sender?.profile

  const candidates = [
    profile?.name,
    profile?.username,
    message?.sender_name,
    message?.username,
  ]

  for (const candidate of candidates) {
    if (
      typeof candidate ===
        'string' &&
      candidate.trim()
    ) {
      return candidate.trim()
    }
  }

  const senderId =
    typeof sender?.id ===
      'string'
      ? sender.id
      : 'Meta customer'

  return senderId
}

/*
 * =========================================================
 * PROCESS FACEBOOK / INSTAGRAM INBOUND MESSAGE
 * =========================================================
 */

async function processSocialMessage(
  supabase: ReturnType<typeof getSupabase>,
  provider:
    | 'facebook'
    | 'instagram',
  connection: Record<
    string,
    unknown
  >,
  message: any,
  entryId: string,
) {
  const organizationId =
    String(
      connection.organization_id ||
        '',
    )

  if (!organizationId) {
    return
  }

  const senderId =
    String(
      message?.sender?.id ||
        '',
    )

  if (!senderId) {
    return
  }

  /*
   * Meta can send echo messages when our own outgoing
   * message comes back through the webhook.
   *
   * Never create a customer/inbound message for an echo.
   */

  if (
    message?.message?.is_echo ===
      true ||
    message?.is_echo === true
  ) {
    return
  }

  const externalId =
    String(
      message?.message?.mid ||
        message?.mid ||
        '',
    ) || null

  /*
   * Duplicate protection happens BEFORE creating or updating
   * the conversation.
   *
   * This is important because Meta retries can otherwise
   * increment unread_count more than once.
   */

  if (externalId) {
    const {
      data: duplicate,
      error:
        duplicateLookupError,
    } = await supabase
      .from('messages')
      .select('id')
      .eq(
        'external_id',
        externalId,
      )
      .limit(1)
      .maybeSingle()

    if (
      duplicateLookupError
    ) {
      console.error(
        'Meta webhook: social duplicate lookup failed',
        duplicateLookupError,
      )
    }

    if (duplicate?.id) {
      console.log(
        'Meta webhook: social duplicate ignored',
        {
          provider,
          externalId,
        },
      )

      return
    }
  }

  const content =
    extractSocialMessageContent(
      message,
    )

  const customerName =
    getSocialCustomerName(
      message,
    )

  /*
   * =======================================================
   * CUSTOMER
   * =======================================================
   */

  let customer =
    await findSocialCustomer(
      supabase,
      organizationId,
      senderId,
    )

  let customerId =
    customer?.id || null

  if (!customerId) {
    const {
      data:
        createdCustomer,
      error,
    } = await supabase
      .from('customers')
      .insert({
        organization_id:
          organizationId,

        name:
          customerName,

        phone:
          senderId,

        source:
          provider ===
          'facebook'
            ? 'facebook'
            : 'instagram',
      })
      .select('id')
      .single()

    if (error) {
      /*
       * If another webhook created the same customer between
       * lookup and insert, try the lookup once again.
       */

      console.error(
        'Meta webhook: social customer insert failed',
        error,
      )

      customer =
        await findSocialCustomer(
          supabase,
          organizationId,
          senderId,
        )

      customerId =
        customer?.id ||
        null

      if (!customerId) {
        return
      }
    } else {
      customerId =
        createdCustomer?.id ||
        null
    }
  }

  if (!customerId) {
    return
  }

  /*
   * =======================================================
   * CONVERSATION
   * =======================================================
   */

  const accountId =
    getSocialConnectionId(
      connection,
    )

  const incomingMetadata: Record<
    string,
    unknown
  > = {
    provider,

    meta_account_id:
      accountId,

    external_user_id:
      senderId,

    external_message_id:
      externalId,

    meta_entry_id:
      entryId,

    message_type:
      message?.message
        ? 'message'
        : 'event',

    timestamp:
      message?.timestamp ||
      null,

    source:
      `${provider}_webhook`,
  }

  let conversationId:
    | string
    | null = null

  const existingConversation =
    await findConversation(
      supabase,
      organizationId,
      customerId,
      provider,
    )

  if (
    existingConversation?.id
  ) {
    conversationId =
      existingConversation.id

    await updateConversation(
      supabase,
      existingConversation.id,
      existingConversation.metadata,
      Number(
        existingConversation
          .unread_count || 0,
      ),
      incomingMetadata,
    )
  } else {
    const now =
      new Date().toISOString()

    const {
      data:
        createdConversation,
      error,
    } = await supabase
      .from('conversations')
      .insert({
        organization_id:
          organizationId,

        customer_id:
          customerId,

        channel:
          provider,

        handled_by:
          'ai',

        last_message_at:
          now,

        status:
          'open',

        subject:
          customerName,

        unread_count:
          1,

        metadata:
          incomingMetadata,
      })
      .select('id')
      .single()

    if (error) {
      /*
       * Concurrent webhook:
       * retrieve the conversation that was created by
       * another request.
       */

      console.error(
        'Meta webhook: social conversation insert failed',
        error,
      )

      const concurrent =
        await findConversation(
          supabase,
          organizationId,
          customerId,
          provider,
        )

      if (
        concurrent?.id
      ) {
        conversationId =
          concurrent.id

        await updateConversation(
          supabase,
          concurrent.id,
          concurrent.metadata,
          Number(
            concurrent
              .unread_count || 0,
          ),
          incomingMetadata,
        )
      }
    } else {
      conversationId =
        createdConversation?.id ||
        null
    }
  }

  if (!conversationId) {
    return
  }

  /*
   * =======================================================
   * MESSAGE
   * =======================================================
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

        received_at:
          new Date()
            .toISOString(),
      },
    })

  if (
    messageInsertError
  ) {
    /*
     * Unique external_id index protects us from Meta
     * retries even if two webhook requests arrive at the
     * same time.
     */

    if (
      messageInsertError.code ===
      '23505'
    ) {
      console.log(
        'Meta webhook: social duplicate external_id ignored',
        {
          provider,
          externalId,
        },
      )
    } else {
      console.error(
        'Meta webhook: social message insert failed',
        messageInsertError,
      )
    }

    return
  }

  console.log(
    'Meta webhook: social incoming message saved',
    {
      provider,
      organizationId,
      conversationId,
      customerId,
      externalId,
    },
  )
}

/*
 * =========================================================
 * FACEBOOK / INSTAGRAM ENTRY PROCESSOR
 * =========================================================
 */

async function processSocialEntry(
  supabase: ReturnType<typeof getSupabase>,
  provider:
    | 'facebook'
    | 'instagram',
  entry: any,
) {
  const entryId =
    String(
      entry?.id || '',
    )

  if (!entryId) {
    return
  }

  const connection =
    await findSocialConnection(
      supabase,
      provider,
      entryId,
    )

  if (
    !connection?.organization_id
  ) {
    console.warn(
      'Meta webhook: no social connection found',
      {
        provider,
        entryId,
      },
    )

    return
  }

  /*
   * Messenger / Instagram webhooks normally expose
   * incoming events in entry.messaging.
   */

  const messaging =
    Array.isArray(
      entry?.messaging,
    )
      ? entry.messaging
      : []

  for (
    const messageEvent of messaging
  ) {
    if (!messageEvent) {
      continue
    }

    /*
     * Ignore read / delivery / typing events here.
     * Phase 2 is inbound customer messages.
     */

    if (
      messageEvent?.read ||
      messageEvent?.delivery ||
      messageEvent?.message?.is_echo
    ) {
      continue
    }

    if (
      !messageEvent?.message &&
      !messageEvent?.postback
    ) {
      continue
    }

    await processSocialMessage(
      supabase,
      provider,
      connection as Record<
        string,
        unknown
      >,
      messageEvent,
      entryId,
    )
  }
}

/*
 * =========================================================
 * MAIN HANDLER
 * =========================================================
 */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader(
    'Cache-Control',
    'no-store',
  )

  const verifyToken =
    env(
      'META_WHATSAPP_VERIFY_TOKEN',
    )

  /*
   * =========================================================
   * META WEBHOOK VERIFICATION
   * =========================================================
   */

  if (req.method === 'GET') {
    const mode =
      req.query['hub.mode']

    const token =
      req.query[
        'hub.verify_token'
      ]

    const challenge =
      req.query[
        'hub.challenge'
      ]

    if (
      mode === 'subscribe' &&
      token === verifyToken &&
      typeof challenge ===
        'string'
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
        error:
          'Method not allowed',
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

    const signature =
      String(
        req.headers[
          'x-hub-signature-256'
        ] || '',
      )

    if (
      !verifySignature(
        rawBody,
        signature,
        env(
          'META_APP_SECRET',
        ),
      )
    ) {
      console.error(
        'Meta webhook: invalid Meta signature',
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
        'Meta webhook: invalid JSON payload',
        error,
      )

      return res
        .status(400)
        .json({
          error:
            'Invalid JSON payload',
        })
    }

    const webhookObject =
      String(
        payload?.object ||
          '',
      )

    /*
     * =======================================================
     * SUPABASE
     * =======================================================
     */

    const supabase =
      getSupabase()

    /*
     * =======================================================
     * FACEBOOK MESSENGER
     * =======================================================
     *
     * Meta Page webhooks use:
     * object = page
     */

    if (
      webhookObject ===
      'page'
    ) {
      const entries =
        Array.isArray(
          payload?.entry,
        )
          ? payload.entry
          : []

      for (
        const entry of entries
      ) {
        await processSocialEntry(
          supabase,
          'facebook',
          entry,
        )
      }

      return res
        .status(200)
        .json({
          received: true,
          provider:
            'facebook',
        })
    }

    /*
     * =======================================================
     * INSTAGRAM
     * =======================================================
     *
     * Instagram messaging webhooks use:
     * object = instagram
     */

    if (
      webhookObject ===
      'instagram'
    ) {
      const entries =
        Array.isArray(
          payload?.entry,
        )
          ? payload.entry
          : []

      for (
        const entry of entries
      ) {
        await processSocialEntry(
          supabase,
          'instagram',
          entry,
        )
      }

      return res
        .status(200)
        .json({
          received: true,
          provider:
            'instagram',
        })
    }

    /*
     * =======================================================
     * WHATSAPP
     * =======================================================
     *
     * Existing WhatsApp logic is intentionally preserved.
     */

    if (
      webhookObject !==
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
     * =======================================================
     * PROCESS WHATSAPP ENTRIES
     * =======================================================
     */

    const entries =
      Array.isArray(
        payload?.entry,
      )
        ? payload.entry
        : []

    for (
      const entry of entries
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
          .limit(1)
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
              status?.status ||
                '',
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
            deliveryStatus ===
              'read' &&
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
            .update(
              updateData,
            )
            .eq(
              'id',
              matchedMessage.id,
            )

          if (
            statusUpdateError
          ) {
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

          const customer =
            await findCustomer(
              supabase,
              connection.organization_id,
              waId,
            )

          let customerId =
            customer?.id ||
            null

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

          const existingConversation =
            await findConversation(
              supabase,
              connection.organization_id,
              customerId,
              'whatsapp',
            )

          if (
            existingConversation?.id
          ) {
            const existingConversationId =
              existingConversation.id

            conversationId =
              existingConversationId

            await updateConversation(
              supabase,
              existingConversationId,
              existingConversation.metadata,
              Number(
                existingConversation
                  .unread_count ||
                  0,
              ),
              incomingMetadata,
            )
          } else {
            const now =
              new Date().toISOString()

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
                  now,

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
              if (
                error.code ===
                '23505'
              ) {
                const concurrent =
                  await findConversation(
                    supabase,
                    connection.organization_id,
                    customerId,
                    'whatsapp',
                  )

                if (
                  concurrent?.id
                ) {
                  const concurrentConversationId =
                    concurrent.id

                  conversationId =
                    concurrentConversationId

                  await updateConversation(
                    supabase,
                    concurrentConversationId,
                    concurrent.metadata,
                    Number(
                      concurrent
                        .unread_count ||
                        0,
                    ),
                    incomingMetadata,
                  )
                }
              } else {
                console.error(
                  'WhatsApp webhook: conversation insert failed',
                  error,
                )

                continue
              }
            } else {
              conversationId =
                createdConversation?.id ||
                null
            }
          }

          if (!conversationId) {
            continue
          }

          /*
           * =================================================
           * DUPLICATE MESSAGE PROTECTION
           * =================================================
           */

          const externalId =
            String(
              message?.id || '',
            ) || null

          if (externalId) {
            const {
              data:
                duplicate,
              error:
                duplicateLookupError,
            } = await supabase
              .from('messages')
              .select('id')
              .eq(
                'external_id',
                externalId,
              )
              .limit(1)
              .maybeSingle()

            if (
              duplicateLookupError
            ) {
              console.error(
                'WhatsApp webhook: duplicate lookup failed',
                duplicateLookupError,
              )
            }

            if (
              duplicate?.id
            ) {
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

          if (
            messageInsertError
          ) {
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
     * =======================================================
     * ACKNOWLEDGE META
     * =======================================================
     */

    return res
      .status(200)
      .json({
        received: true,
      })
  } catch (error) {
    console.error(
      'Meta webhook: fatal error',
      error,
    )

    /*
     * Do not expose internal errors or secrets.
     * Return 200 to avoid endless Meta retries.
     */

    return res
      .status(200)
      .json({
        received: true,
      })
  }
}
