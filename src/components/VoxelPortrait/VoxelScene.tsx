import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, Object3D, Vector3, type InstancedMesh } from 'three'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

const MAX_YAW = MathUtils.degToRad(14)
const MAX_PITCH = MathUtils.degToRad(8)
const ASSEMBLE_SECONDS = 1.2
const SCATTER_RADIUS = 60

function VoxelCloud({ animate }: { animate: boolean }) {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pointer = useRef({ x: 0, y: 0 })
  const elapsed = useRef(0)
  const { size } = useThree()

  // Per-voxel destinations, scatter origins, stagger delays and colors, once.
  const layout = useMemo(() => {
    const half = data.size / 2
    const ys = data.voxels.map((v) => v[1])
    const minY = Math.min(...ys)
    const span = Math.max(1, Math.max(...ys) - minY)

    return data.voxels.map(([x, y, z, r, g, b]) => ({
      target: new Vector3(x, y, z - half * 0.35),
      origin: new Vector3(
        x + (Math.random() - 0.5) * SCATTER_RADIUS,
        y + (Math.random() - 0.5) * SCATTER_RADIUS,
        z + (Math.random() - 0.5) * SCATTER_RADIUS,
      ),
      // Bottom voxels land first, so the portrait builds upward.
      delay: ((y - minY) / span) * 0.45,
      color: new Color(r / 255, g / 255, b / 255),
    }))
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    layout.forEach((voxel, i) => mesh.setColorAt(i, voxel.color))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [layout])

  useEffect(() => {
    if (!animate) return
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [animate])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    elapsed.current += delta
    const t = animate ? Math.min(1, elapsed.current / ASSEMBLE_SECONDS) : 1

    // Assemble the cloud, easing each voxel in after its own stagger delay.
    if (elapsed.current <= ASSEMBLE_SECONDS + delta) {
      layout.forEach((voxel, i) => {
        const local = MathUtils.clamp((t - voxel.delay) / (1 - voxel.delay || 1), 0, 1)
        const eased = 1 - Math.pow(1 - local, 3)
        dummy.position.lerpVectors(voxel.origin, voxel.target, eased)
        dummy.scale.setScalar(0.9 * eased)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    if (!animate) {
      mesh.rotation.set(0, 0, 0)
      return
    }

    // Touch devices have no cursor, so drift on a slow sine instead.
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    const targetYaw = isCoarse
      ? Math.sin(elapsed.current * 0.4) * MAX_YAW
      : pointer.current.x * MAX_YAW + Math.sin(elapsed.current * 0.3) * 0.02
    const targetPitch = isCoarse
      ? Math.sin(elapsed.current * 0.25) * MAX_PITCH * 0.5
      : pointer.current.y * MAX_PITCH + Math.cos(elapsed.current * 0.22) * 0.015

    // Damped follow: the head eases toward the cursor and never snaps.
    mesh.rotation.y = MathUtils.damp(mesh.rotation.y, targetYaw, 3, delta)
    mesh.rotation.x = MathUtils.damp(mesh.rotation.x, targetPitch, 3, delta)
  })

  return (
    <group scale={size.width < 768 ? 0.75 : 1}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, layout.length]}>
        <boxGeometry args={[0.92, 0.92, 0.92]} />
        <meshStandardMaterial roughness={0.62} metalness={0.08} />
      </instancedMesh>
    </group>
  )
}

export default function VoxelScene({ animate }: { animate: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 92], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[30, 40, 60]} intensity={2.1} />
      {/* Cyan rim light lifts the silhouette off the near-black ground. */}
      <directionalLight position={[-50, 10, -30]} intensity={1.6} color="#22D3EE" />
      <VoxelCloud animate={animate} />
    </Canvas>
  )
}
