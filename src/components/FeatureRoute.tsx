import React from ‘react’
import { useSubscription } from ‘../lib/useSubscription’
import FeatureLocked from ‘./FeatureLocked’

export default function FeatureRoute({
feature,
featureName,
children,
}: {
feature: string
featureName: string
children: React.ReactNode
}) {
const {
loading,
isActive,
hasFeature,
} = useSubscription()

if (loading) {
return (
)
}

if (!isActive) {
return 
}

if (!hasFeature(feature)) {
return 
}

return <>{children}</>
}
