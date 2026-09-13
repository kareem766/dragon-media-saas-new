import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>

    if (
      typeof value.message === 'string' &&
      value.message.trim()
    ) {
      return value.message
    }

    if (
      typeof value.error === 'string' &&
      value.error.trim()
    ) {
      return value.error
    }

    try {
      const serialized = JSON.stringify(error)

      if (
        serialized &&
        serialized !== '{}'
      ) {
        return serialized
      }
    } catch {
      // Ignore serialization failures.
    }
  }

  return 'تعذر تحميل بيانات لوحة الإدارة.'
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    /*
     * Dynamic import is intentional.
     *
     * It prevents module-loading errors inside the
     * admin handler from causing an unhandled
     * FUNCTION_INVOCATION_FAILED before this wrapper
     * can return a useful JSON error.
     */
    const module = await import(
      '../../src/server/admin/overview'
    )

    const overview = module.default

    if (typeof overview !== 'function') {
      throw new Error(
        'ملف لوحة الإدارة لا يحتوي على handler صالح.'
      )
    }

    return await overview(req, res)
  } catch (error) {
    console.error(
      'Admin overview API error:',
      error,
    )

    if (!res.headersSent) {
      return res.status(500).json({
        error: getErrorMessage(error),
      })
    }

    return undefined
  }
}
