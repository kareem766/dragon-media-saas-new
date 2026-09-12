import React from 'react'
import { useSubscription } from '../lib/useSubscription'
import FeatureLocked from './FeatureLocked'

interface FeatureRouteProps {
  feature: string
  featureName: string
  children: React.ReactNode
}

export default function FeatureRoute({
  feature,
  featureName,
  children,
}: FeatureRouteProps) {
  const { loading, isActive, hasFeature } = useSubscription()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    )
  }

  if (!isActive) {
    return <FeatureLocked featureName={featureName} />
  }

  if (!hasFeature(feature)) {
    return <FeatureLocked featureName={featureName} />
  }

  return <>{children}</>
}
