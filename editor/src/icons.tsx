import type { ReactNode } from 'react'

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PostsIcon = () => (
  <Icon>
    <path d="M4 4h16v16H4z" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Icon>
)
export const ProjectsIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
)
export const ImageIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </Icon>
)
export const BranchIcon = () => (
  <Icon size={14}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="9" r="2.5" />
    <path d="M6 8.5v7M18 11.5c0 3-4 3-9.5 5" />
  </Icon>
)
export const PlusIcon = () => (
  <Icon size={14}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const SearchIcon = () => (
  <Icon size={14}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
)
export const BackIcon = () => (
  <Icon>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
)
export const EyeIcon = () => (
  <Icon size={15}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)
export const LinkIcon = () => (
  <Icon>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </Icon>
)
export const BulletIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Icon>
)
export const NumberIcon = () => (
  <Icon>
    <path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5c.5-1 2.5-1 2.5.5S3.5 17 3.5 19H6" />
  </Icon>
)
export const QuoteIcon = () => (
  <Icon>
    <path d="M7 7h4v5c0 3-2 5-4 5M15 7h4v5c0 3-2 5-4 5" />
  </Icon>
)
export const CodeBlockIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 10l-2 2 2 2M15 10l2 2-2 2" />
  </Icon>
)
export const DividerIcon = () => (
  <Icon>
    <path d="M3 12h18" />
  </Icon>
)
export const TrashIcon = () => (
  <Icon size={14}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
)
export const RefreshIcon = () => (
  <Icon size={15}>
    <path d="M20 11a8 8 0 00-14.9-3M4 13a8 8 0 0014.9 3" />
    <path d="M4 4v4h4M20 20v-4h-4" />
  </Icon>
)
export const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
)
export const ExternalIcon = () => (
  <Icon size={14}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Icon>
)
export const UploadIcon = () => (
  <Icon size={14}>
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </Icon>
)
