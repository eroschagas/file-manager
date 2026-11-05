export interface OrganizationIssue {
  path: string
  message: string
}
export interface OrganizationFolder {
  path: string
  count: number
}
export interface OrganizationPreview {
  id: string
  root: string
  totalFiles: number
  pendingFiles: number
  alreadyOrganized: number
  renamedFiles: number
  folders: OrganizationFolder[]
  issues: OrganizationIssue[]
}
export interface OrganizationProgress {
  phase: 'reading' | 'planning' | 'moving'
  processed: number
  total: number
  currentFile: string
}
export interface OrganizationResult {
  root: string
  movedFiles: number
  alreadyOrganized: number
  renamedFiles: number
  cancelled: boolean
  folders: OrganizationFolder[]
  issues: OrganizationIssue[]
}
export interface OrganizerApi {
  chooseOrganizerFolder: () => Promise<string | null>
  previewOrganization: (folder: string) => Promise<OrganizationPreview>
  organizeFiles: (
    previewId: string,
    deleteEmptyFolders?: boolean,
  ) => Promise<OrganizationResult | null>
  cancelOrganization: () => Promise<void>
  onOrganizationProgress: (callback: (progress: OrganizationProgress) => void) => () => void
}
