import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, Object3D, Vector3, type InstancedMesh } from 'three'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

const MAX_YAW = MathUtils.degToRad(14)
const MAX_PITCH = MathUtils.degToRad(8)
/** Standing three-quarter turn: head-on, the relief's steps catch no light. */
const BASE_YAW = MathUtils.degToRad(-16)
const ASSEMBLE_SECONDS = 1.2
/** Framing is tuned for this many cells across; other grids scale to match. */
const REFERENCE_GRID = 64
/**
 * Cube footprint within its cell; the remainder is the seam between blocks.
 * Keep it tight: wide seams open canyons between the extruded columns, and
 * wherever the view axis runs parallel to one you see straight through to the
 * background as a dark line across the face.
 */
const FACE = 0.94

function VoxelCloud({ animate }: { animate: boolean }) {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pointer = useRef({ x: 0, y: 0 })
  const elapsed = useRef(0)
  const { size } = useThree()

  // Per-voxel destinations, scatter origins, stagger delays and colors, once.
  const layout = useMemo(() => {
    const ys = data.voxels.map((v) => v[1])
    const zs = data.voxels.map((v) => v[2])
    const minY = Math.min(...ys)
    const span = Math.max(1, Math.max(...ys) - minY)

    // Extrude every voxel back to one base plane instead of leaving it a
    // single floating cube: the columns give the relief real mass, and their
    // side faces are what catch the raking light and read as depth.
    const baseZ = Math.min(...zs) - 1
    const centreZ = (baseZ + Math.max(...zs)) / 2
    const scatter = data.size * 1.4

    return data.voxels.map(([x, y, z, r, g, b]) => {
      const depth = z - baseZ
      return {
        depth,
        target: new Vector3(x, y, baseZ + depth / 2 - centreZ),
        origin: new Vector3(
          x + (Math.random() - 0.5) * scatter,
          y + (Math.random() - 0.5) * scatter,
          z + (Math.random() - 0.5) * scatter,
        ),
        // Bottom voxels land first, so the portrait builds upward.
        delay: ((y - minY) / span) * 0.45,
        color: new Color(r / 255, g / 255, b / 255),
      }
    })
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
        dummy.scale.set(FACE * eased, FACE * eased, voxel.depth * eased)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    if (!animate) {
      mesh.rotation.set(0, BASE_YAW, 0)
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
    mesh.rotation.y = MathUtils.damp(mesh.rotation.y, BASE_YAW + targetYaw, 3, delta)
    mesh.rotation.x = MathUtils.damp(mesh.rotation.x, targetPitch, 3, delta)
  })

  const fit = REFERENCE_GRID / data.size
  return (
    <group scale={(size.width < 768 ? 0.75 : 1) * fit}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, layout.length]}>
        {/* Unit cube; each instance scales it into its own column. */}
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.78} metalness={0.02} />
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
      // ACES tone mapping (r3f's default) washes the pale skin tones flat.
      flat
    >
      {/* Keep ambient low. It is the difference between a block's top, front
          and side faces that reads as depth, and ambient light flattens all
          three toward the same value. */}
      <ambientLight intensity={0.26} />
      {/* Key from high and to the side, so every step's top face catches it. */}
      <directionalLight position={[45, 78, 40]} intensity={2.15} />
      <directionalLight position={[-50, -18, 35]} intensity={0.5} color="#8FA3C4" />
      {/* Cyan rim light lifts the silhouette off the near-black ground. */}
      <directionalLight position={[-55, 18, -30]} intensity={1.25} color="#22D3EE" />
      <VoxelCloud animate={animate} />
    </Canvas>
  )
}
