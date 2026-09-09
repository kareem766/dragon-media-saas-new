import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useOrganization } from './useOrganization'

export interface DBNotification {
  id: string
  title: string
  message: string | null
  body: string | null
  link: string | null
  type: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export function useNotifications() {
  const { organizationId } = useOrganization()

  const [notifications, setNotifications] = useState<DBNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !organizationId) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      const userId = userData.user?.id

      if (!userId) {
        setNotifications([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select(
          'id, title, message, body, link, type, is_read, read_at, created_at'
        )
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (fetchError) {
        throw fetchError
      }

      setNotifications((data ?? []) as DBNotification[])
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل الإشعارات.')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    load()
  }, [load])

  // Realtime notifications
  useEffect(() => {
    const client = supabase

    if (!client || !organizationId) {
      return
    }

    let cancelled = false
    let channel: ReturnType<typeof client.channel> | null = null

    const subscribe = async () => {
      const { data: userData } = await client.auth.getUser()

      const userId = userData.user?.id

      if (!userId || cancelled) {
        return
      }

      channel = client
        .channel(`notifications-hook-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            load()
          }
        )
        .subscribe()
    }

    subscribe()

    return () => {
      cancelled = true

      if (channel) {
        client.removeChannel(channel)
      }
    }
  }, [organizationId, load])

  // Mark one notification as read
  const markRead = async (id: string) => {
    if (!supabase || !organizationId) {
      return
    }

    const readAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              is_read: true,
              read_at: readAt,
            }
          : notification
      )
    )
  }

  // Mark all notifications as read
  const markAllRead = async () => {
    if (!supabase || !organizationId) {
      return
    }

    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) {
      return
    }

    const readAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: readAt,
      })
      .in('id', unreadIds)
      .eq('organization_id', organizationId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        unreadIds.includes(notification.id)
          ? {
              ...notification,
              is_read: true,
              read_at: readAt,
            }
          : notification
      )
    )
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markRead,
    markAllRead,
    refresh: load,
  }
}
