export interface Project {
  name: string
  url: string
  blurb: string
  language: string | null
  stars: number
  pushedAt: string
  featured: boolean
}

export interface VoxelData {
  size: number
  count: number
  /** [x, y, z, r, g, b] */
  voxels: number[][]
}
