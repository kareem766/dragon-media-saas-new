import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import organizations from '../../src/server/admin/organizations'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  return organizations(req, res)
}
