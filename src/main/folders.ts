import { realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, sep } from 'node:path'

export const isInsideFolder = (root: string, target: string): boolean => {
  const path = relative(root, target)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

export const getFolderPickerDirectory = (folders: string[]): string | undefined => {
  if (!folders.length) return undefined
  if (folders.length === 1) return dirname(folders[0])
  let common = folders[0]
  while (
    !folders.every((folder) => relative(common, folder) === '' || isInsideFolder(common, folder))
  ) {
    const parent = dirname(common)
    // Different drives/shares have no common ancestor. Use the last folder's parent.
    if (parent === common) return dirname(folders[folders.length - 1])
    common = parent
  }
  return common
}

export const resolveFolders = async (folders: unknown): Promise<string[]> => {
  if (
    !Array.isArray(folders) ||
    !folders.length ||
    !folders.every(
      (folder) => typeof folder === 'string' && folder.trim() && isAbsolute(folder.trim()),
    )
  )
    throw new Error('Enter the full path to each folder.')
  const resolved = await Promise.all(
    (folders as string[]).map(async (folder) => {
      const path = await realpath(folder.trim())
      if (!(await stat(path)).isDirectory()) throw new Error(`The path is not a folder: ${folder}`)
      return path
    }),
  )
  return resolved.filter(
    (path, index) =>
      !resolved.some(
        (other, otherIndex) =>
          (otherIndex < index && relative(other, path) === '') || isInsideFolder(other, path),
      ),
  )
}
