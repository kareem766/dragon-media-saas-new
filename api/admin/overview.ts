import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import overview from '../../src/server/admin/overview.ts'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    return await overview(req, res)
  } catch (error: unknown) {
    console.error('Admin overview API error:', error)

    if (!res.headersSent) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'تعذر تحميل بيانات لوحة الإدارة.'

      return res.status(500).json({
        error: message,
      })
    }

    return undefined
  }
}
