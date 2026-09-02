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
/** Radians of rotation per pixel dragged. ~200px sweeps a right angle. */
const DRAG_SPEED = 0.008
/** Stop short of straight up or down, where the portrait reads as nonsense. */
const MAX_DRAG_PITCH = MathUtils.degToRad(55)

function VoxelCloud({ animate }: { animate: boolean }) {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pointer = useRef({ x: 0, y: 0 })
  const elapsed = useRef(0)
  // Rotation the viewer has dragged in. It persists after release, and the
  // cursor-follow then plays on top of it rather than snapping back.
  const drag = useRef({ yaw: 0, pitch: 0 })
  const dragging = useRef(false)
  const { size, gl } = useThree()

  // Per-voxel destinations, scatter origins, stagger delays and colors, once.
  const layout = useMemo(() => {
    const ys = data.voxels.map((v) => v[1])
    const minY = Math.min(...ys)
    const span = Math.max(1, Math.max(...ys) - minY)

    // Each voxel spans its own front and back surface, so the bust is a
    // rounded mass. Extruding everything to one flat plane instead looks fine
    // head-on but collapses into a slab the moment it is dragged round.
    const centreZ =
      (Math.min(...data.voxels.map((v) => v[3])) +
        Math.max(...data.voxels.map((v) => v[2]))) /
      2
    const scatter = data.size * 1.4

    return data.voxels.map(([x, y, front, back, r, g, b]) => {
      const depth = front - back + 1
      const z = (front + back) / 2
      return {
        depth,
        target: new Vector3(x, y, z - centreZ),
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

  // Drag to spin the head. Deliberately not gated on `animate`: reduced-motion
  // asks for no *automatic* movement, and this only moves when the viewer does.
  useEffect(() => {
    const canvas = gl.domElement
    let active = -1
    let lastX = 0
    let lastY = 0

    const onDown = (event: PointerEvent) => {
      if (active !== -1) return
      active = event.pointerId
      dragging.current = true
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== active) return
      drag.current.yaw += (event.clientX - lastX) * DRAG_SPEED
      drag.current.pitch = MathUtils.clamp(
        drag.current.pitch + (event.clientY - lastY) * DRAG_SPEED,
        -MAX_DRAG_PITCH,
        MAX_DRAG_PITCH,
      )
      lastX = event.clientX
      lastY = event.clientY
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== active) return
      active = -1
      dragging.current = false
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId)
      }
      canvas.style.cursor = 'grab'
    }

    canvas.style.cursor = 'grab'
    // pan-y, not none. The portrait is full width and first on the page on a
    // phone, so claiming every gesture would trap the reader: this lets a
    // vertical swipe scroll as usual while a horizontal drag turns the head.
    canvas.style.touchAction = 'pan-y'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [gl])

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

    // While dragging, and under reduced motion, the viewer's own rotation is
    // the only input; nothing sways on its own.
    const held = dragging.current
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    const idle = !animate || held

    // Touch devices have no cursor, so drift on a slow sine instead.
    const followYaw = idle
      ? 0
      : isCoarse
        ? Math.sin(elapsed.current * 0.4) * MAX_YAW
        : pointer.current.x * MAX_YAW + Math.sin(elapsed.current * 0.3) * 0.02
    const followPitch = idle
      ? 0
      : isCoarse
        ? Math.sin(elapsed.current * 0.25) * MAX_PITCH * 0.5
        : pointer.current.y * MAX_PITCH + Math.cos(elapsed.current * 0.22) * 0.015

    // Damped follow: the head eases toward its target and never snaps. Tracking
    // is much tighter while dragging, so the head stays under the finger.
    const lambda = held ? 18 : 3
    mesh.rotation.y = MathUtils.damp(
      mesh.rotation.y,
      BASE_YAW + drag.current.yaw + followYaw,
      lambda,
      delta,
    )
    mesh.rotation.x = MathUtils.damp(
      mesh.rotation.x,
      drag.current.pitch + followPitch,
      lambda,
      delta,
    )
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
