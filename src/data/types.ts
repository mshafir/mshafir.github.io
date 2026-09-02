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
  count: number
  /** [x, y, z, r, g, b] — one unit cube each */
  voxels: number[][]
}
