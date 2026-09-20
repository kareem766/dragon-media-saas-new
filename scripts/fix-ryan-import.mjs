import { readFileSync, writeFileSync } from 'node:fs'

const path = 'api/admin/ryan-inbox.ts'
const source = readFileSync(path, 'utf8')
const from = "import { prepareRyanMultimodal } from '../_server/admin/ryan-multimodal'"
const to = "import { prepareRyanMultimodal } from '../../src/server/ryan-multimodal.js'"

if (source.includes(to)) process.exit(0)
if (!source.includes(from)) throw new Error('Ryan multimodal import pattern not found')
writeFileSync(path, source.replace(from, to), 'utf8')
