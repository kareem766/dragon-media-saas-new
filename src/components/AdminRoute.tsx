import React from ‘react’
import { Navigate } from ‘react-router-dom’
import { useAuth } from ‘../lib/AuthContext’
import { useIsPlatformAdmin } from ‘../lib/useIsPlatformAdmin’

export default function AdminRoute({
children,
}: {
children: React.ReactNode
}) {
const { session, loading: authLoading } = useAuth()
const { isAdmin, loading: adminLoading } = useIsPlatformAdmin()

if (authLoading || adminLoading) {
return (
)
}

if (!session) {
return 
}

if (!isAdmin) {
return 
}

return <>{children}</>
}
