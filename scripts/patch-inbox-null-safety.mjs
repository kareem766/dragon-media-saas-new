import fs from 'node:fs'

const path = 'src/pages/Inbox.tsx'
let source = fs.readFileSync(path, 'utf8')

source = source.replace(
  "return () => { void supabase.removeChannel(conversationsChannel) }",
  "return () => { void supabase?.removeChannel(conversationsChannel) }",
)

source = source.replace(
  "return () => { void supabase.removeChannel(messagesChannel) }",
  "return () => { void supabase?.removeChannel(messagesChannel) }",
)

source = source.replace(
  "if (!content || !activeConversationId || !organizationId || !supabase) return\n    if (!user?.id)",
  "if (!content || !activeConversationId || !organizationId || !supabase) return\n    const client = supabase\n    if (!user?.id)",
)

source = source.replace(
  "const { error: handlerError } = await supabase\n      .from('conversations')",
  "const { error: handlerError } = await client\n      .from('conversations')",
)

source = source.replace(
  "const { data, error: insertError } = await supabase\n      .from('messages')",
  "const { data, error: insertError } = await client\n      .from('messages')",
)

fs.writeFileSync(path, source)
console.log('Inbox null-safety patch applied')
