import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useOrganization } from './useOrganization'

interface DBNotification {
  id: string
  title: string
  body: string | null
  read: boolean
  created_at: string
}

export function useNotifications() {
  const { organizationId } = useOrganization()
  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !organizationId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, read, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data as DBNotification[])
    setLoading(false)
  }, [organizationId])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    if (!supabase) return
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    if (!supabase || !organizationId) return
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markRead, markAllRead, refresh: load }
}
