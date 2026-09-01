import { useEffect, useRef } from 'react'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

/**
 * Flat painted version of the same voxel grid for browsers without WebGL.
 * Depth becomes brightness rather than geometry.
 */
export function VoxelFallback() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const size = data.size
    const cell = Math.floor(canvas.width / size)
    const half = size / 2
    const maxZ = Math.max(...data.voxels.map((v) => v[2]), 1)

    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const [x, y, z, r, g, b] of data.voxels) {
      // Nearer voxels read brighter, which reads as depth on a flat surface.
      const shade = 0.55 + 0.45 * (z / maxZ)
      context.fillStyle = `rgb(${r * shade} ${g * shade} ${b * shade})`
      context.fillRect((x + half) * cell, (half - y) * cell, cell, cell)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={512}
      height={512}
      className="voxel__fallback"
      role="img"
      aria-label="Voxel portrait of Michael Shafir"
    />
  )
}
