import type {
  VercelRequest,
  VercelResponse,
} from '@vercel/node'

import overview from '../../src/server/admin/overview'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  return overview(req, res)
}
