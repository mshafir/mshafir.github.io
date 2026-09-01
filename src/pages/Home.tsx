import { Seo } from '../components/Seo'
import { VoxelPortrait } from '../components/VoxelPortrait/VoxelPortrait'

export default function Home() {
  return (
    <>
      <Seo title="Home" description="Michael Shafir — software architect writing about AI." path="/" />
      <h1>Michael Shafir</h1>
      <VoxelPortrait />
    </>
  )
}
