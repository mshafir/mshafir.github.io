import { Suspense, lazy, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { VoxelFallback } from './VoxelFallback'
import { hasWebGL } from './hasWebGL'
import './VoxelPortrait.css'

// Kept out of the prerender pass and off the critical path: three.js is large
// and touches window during module evaluation.
const VoxelScene = lazy(() => import('./VoxelScene'))

export function VoxelPortrait() {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    setWebgl(hasWebGL())
    setMounted(true)
  }, [])

  return (
    <div className="voxel" role="img" aria-label="Voxel portrait of Michael Shafir">
      {!mounted && <div className="voxel__placeholder" aria-hidden="true" />}
      {mounted && !webgl && <VoxelFallback />}
      {mounted && webgl && (
        <Suspense fallback={<div className="voxel__placeholder" aria-hidden="true" />}>
          <VoxelScene animate={!reducedMotion} />
        </Suspense>
      )}
    </div>
  )
}
