import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

const overviewModule = require('../../src/server/admin/overview')

const overview =
  overviewModule?.default ?? overviewModule

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (typeof overview !== 'function') {
      return res.status(500).json({
        error:
          'ملف لوحة الإدارة لا يحتوي على handler صالح.',
      })
    }

    return await overview(req, res)
  } catch (error: unknown) {
    console.error(
      'Admin overview API error:',
      error
    )

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
