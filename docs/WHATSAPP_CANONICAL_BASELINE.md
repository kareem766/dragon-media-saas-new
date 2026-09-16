# Dragon Media — WhatsApp Canonical Baseline

> This document records the **verified working WhatsApp integration baseline** as of 2026-09-16. Treat it as the recovery/reference point before changing Meta, WhatsApp, Ryan, webhook, inbox, or outbound-dispatch code.

## Verified end-to-end flow

`WhatsApp customer message`
→ `Meta WhatsApp Cloud API`
→ `POST /api/meta/webhook`
→ `integrations` lookup by WABA/phone number
→ `customers / conversations / messages` in Supabase
→ `Ryan / Gemini`
→ internal outbound dispatch
→ `POST /api/meta/whatsapp/send`
→ Meta Graph API
→ customer WhatsApp
→ Meta delivery/read webhook
→ `messages.metadata` status update in Supabase

This flow was verified with a real WABA and real WhatsApp number.

## Verified production identifiers

- Vercel project: `dragon-media-saas-new`
- Production deployment verified: `dpl_ANMtqGgQxpd3GxPywHT4dd5KwQMx`
- Branch: `main`
- WABA ID: `933282725860978`
- Phone Number ID: `1212129291993636`
- Display number: `+20 10 96656281`
- Verified name: `Dragon Media`
- `ready_for_messaging`: `true`
- Organization ID: `7b58d91a-b355-44ab-b22e-c6c72628802c`
- Verified integration row ID: `4a146baa-8400-4b0f-ae5e-2687d0cee0f7`
- WhatsApp conversation verified: `fc5b61bd-22b1-41d3-ac29-2d5b02220b02`

## Meta redirect URIs

These are the verified redirect URIs configured for the Meta app:

- `https://dragon-media-saas-new.vercel.app/api/meta/oauth/callback`
- `https://dragon-media-saas-new.vercel.app/api/meta/whatsapp/signup`

Production domain:

- `https://dragon-media-saas-new.vercel.app/`

Meta JS SDK is enabled.

## Critical source files / routes

### Frontend

- `src/pages/MetaConnections.tsx`
  - Loads real `integrations` state for `whatsapp`, `facebook`, and `instagram`.
  - Gets the current Supabase session.
  - Starts Meta OAuth through `/api/meta/oauth/start`.
  - Uses Meta JS SDK Embedded Signup with `config_id`.
  - Uses `response_type: 'code'` and `override_default_response_type: true`.
  - Listens for `WA_EMBEDDED_SIGNUP` events.
  - Sends returned code/state/WABA/phone/business identifiers to the callback.

### Meta OAuth / Embedded Signup

- `api/meta/oauth/start.ts`
  - Validates the Supabase bearer token.
  - Validates organization membership.
  - Creates signed state.
  - Returns the Meta OAuth URL/configuration.
  - Uses the fixed production redirect URI.

- `api/meta/oauth/callback.ts`
  - Handles POST and legacy GET callback paths.
  - Verifies signed state.
  - Exchanges the Meta authorization code using the exact redirect URI.
  - Uses supplied WABA/phone/business IDs when available.
  - Fetches/validates the WABA and phone data.
  - Subscribes the WABA to the Meta app.
  - Encrypts/stores the access token server-side.
  - Upserts the `integrations` row with provider `whatsapp`, connected state, and safe metadata.

- `api/meta/whatsapp/signup.ts`
  - Embedded Signup support path retained in the known-good architecture.

- `api/meta/whatsapp/complete.ts`
  - Existing Embedded Signup completion path from the known-good architecture.
  - Important historical compatibility note: `/complete` expects query-string parameters, not `req.body`.
  - Do not replace this blindly while changing Meta signup.

### Webhook / inbound

- `api/meta/webhook.ts`
  - GET: Meta webhook verification.
  - POST: validates WhatsApp Business Account payloads.
  - Verifies `x-hub-signature-256` using the Meta app secret.
  - Finds the correct `integrations` row using WABA/phone number IDs.
  - Deduplicates incoming messages using `messages.external_id`.
  - Creates/updates customers and conversations.
  - Stores inbound WhatsApp messages as `sender_type = customer`.
  - Triggers the Ryan processing path.
  - Handles outbound delivery/status webhook events and updates message metadata.

### Outbound

- `api/meta/whatsapp/send.ts`
  - **Critical file. Do not regress its internal authentication contract.**
  - Supports normal Supabase bearer authentication for user-driven sends.
  - Supports the internal Ryan outbound-dispatch authentication path.
  - Accepts the organization/conversation/message payload used by the current Ryan dispatch.
  - Loads the connected WhatsApp integration.
  - Decrypts the stored Meta access token server-side.
  - Sends through Meta Graph API v23.0 using the real `phone_number_id`.
  - Stores the returned Meta `wamid` in `messages.external_id`.
  - Marks the outbound message and conversation appropriately.

### UI / integration state

- `src/pages/Settings.tsx`
  - Uses the real Supabase `integrations` state for integration display.
  - Do not reintroduce legacy token/config exposure to the frontend.
  - Legacy Meta references may still exist here; verify before deleting or changing them.

## Supabase tables involved

### `integrations`

Relevant columns:

- `id`
- `organization_id`
- `provider`
- `connected`
- `config` — sensitive server-side configuration/token storage; do not expose to frontend
- `status`
- `connected_at`
- `last_verified_at`
- `error_message`
- `metadata`
- `updated_at`

Unique tenant/provider identity:

- `(organization_id, provider)`

For the verified WhatsApp connection, `metadata` contains the safe connection identifiers such as:

- `waba_id`
- `waba_name`
- `phone_number_id`
- `verified_name`
- `ready_for_messaging`
- `display_phone_number`
- `connected_via: meta_embedded_signup_sdk`

### `customers`

Used by the webhook to resolve/create the WhatsApp customer.

### `conversations`

Verified WhatsApp conversation:

- channel: `whatsapp`
- status: `open`
- conversation ID: `fc5b61bd-22b1-41d3-ac29-2d5b02220b02`

### `messages`

Inbound:

- `sender_type = customer`
- `external_id = Meta wamid`

Ryan response before outbound delivery:

- `sender_type = ai`
- `metadata.source = ryan`
- `metadata.provider = gemini`
- `metadata.model = gemini-3.6-flash`

After successful outbound send:

- real Meta `wamid` stored as `external_id`
- outbound metadata records WhatsApp/Meta status
- subsequent Meta webhook updates delivery/read status

## Verified successful test

Test message received:

- `اختبار 2`

Verified sequence:

1. `POST /api/meta/webhook` returned `200` on deployment `dpl_ANMtqGgQxpd3GxPywHT4dd5KwQMx`.
2. Inbound message was stored in Supabase.
3. Ryan/Gemini generated the response.
4. `POST /api/meta/whatsapp/send` returned `200` on the same production deployment.
5. Meta returned a real outbound `wamid`.
6. Meta sent delivery/read status webhooks.
7. Supabase showed the AI message with `whatsapp_status = read`.

## Critical fixes that produced the working baseline

- `463467b1f270c9d948ac6a61814389df51c5b053`
  - `Fix Ryan WhatsApp outbound authentication`
  - Added the internal Ryan authentication path to outbound sending.

- `dbecd1962804e1c3d4827922dc4215835826d9e8`
  - `Fix WhatsApp outbound dispatch trigger auth`
  - Fixed the mismatch between the Ryan/Supabase internal dispatch contract and `/api/meta/whatsapp/send`.

## Earlier known-good Meta architecture references

Historical commits that may be useful when comparing/recovering Embedded Signup behavior:

- `1747130b8c793ce05e470b63d0983439c8a001db`
- `1314d4bf417396d94423ad8296d9490ad78ba1b9`
- `ec1db617`
- `e0840ece`
- `751e753e88702c91fbc57ea31de739d2161b1473`

Use these only as historical comparison points. The current production baseline above is authoritative for the working end-to-end flow.

## Recovery rules

Before changing any WhatsApp/Meta/Ryan integration code:

1. Compare the proposed change against this document.
2. Do not change the production redirect URI without verifying Meta configuration and callback code together.
3. Do not change the WABA/phone matching logic in `api/meta/webhook.ts` without testing with the real IDs.
4. Do not remove the internal authentication support from `api/meta/whatsapp/send.ts`.
5. Do not expose `integrations.config` or access tokens to the browser.
6. Do not manually insert fake WhatsApp messages to simulate success.
7. After every integration change, verify the full path:
   `Meta inbound → webhook 200 → Supabase message → Ryan/Gemini → send 200 → Meta wamid → delivery/read webhook → Supabase status`.
8. A DB row alone is not proof of delivery. Require the Meta outbound `wamid` and delivery/read evidence.
9. If a future change breaks WhatsApp, use this file plus the listed commits to restore the last known-good implementation before making unrelated changes.

## Security notes

- Never store or document actual Meta access tokens, app secrets, encryption keys, or Supabase service-role keys in this file.
- Tokens must remain backend/server-side and encrypted at rest as implemented by the current callback/send flow.
- Frontend integration views should expose only safe metadata and connection state.
