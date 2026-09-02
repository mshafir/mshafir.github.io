import { useEffect, useRef } from 'react'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

/**
 * Flat painted version of the same figure, for browsers without WebGL.
 *
 * Orthographic front view: voxels are drawn back to front so nearer ones win,
 * and depth becomes brightness rather than geometry.
 */
export function VoxelFallback() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const xs = data.voxels.map((v) => v[0])
    const ys = data.voxels.map((v) => v[1])
    const zs = data.voxels.map((v) => v[2])
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)
    const width = Math.max(...xs) - minX + 1
    const height = Math.max(...ys) - minY + 1

    const cell = Math.max(1, Math.floor(Math.min(canvas.width / width, canvas.height / height)))
    const offsetX = (canvas.width - width * cell) / 2
    const offsetY = (canvas.height - height * cell) / 2
    const depth = Math.max(1, maxZ - minZ)

    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const [x, y, z, r, g, b] of [...data.voxels].sort((a, b) => a[2] - b[2])) {
      // Nearer voxels read brighter, which stands in for depth on a flat plane.
      const shade = 0.62 + 0.38 * ((z - minZ) / depth)
      context.fillStyle = `rgb(${r * shade} ${g * shade} ${b * shade})`
      context.fillRect(
        offsetX + (x - minX) * cell,
        offsetY + (height - 1 - (y - minY)) * cell,
        cell,
        cell,
      )
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
