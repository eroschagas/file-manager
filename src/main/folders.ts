import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'

export const isInsideFolder = (root: string, target: string): boolean => {
  const path = relative(root, target)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

export const resolveFolders = async (folders: unknown): Promise<string[]> => {
  if (
    !Array.isArray(folders) ||
    !folders.length ||
    !folders.every(
      (folder) => typeof folder === 'string' && folder.trim() && isAbsolute(folder.trim()),
    )
  )
    throw new Error('Informe o caminho completo de cada pasta.')
  const resolved = await Promise.all(
    (folders as string[]).map(async (folder) => {
      const path = await realpath(folder.trim())
      if (!(await stat(path)).isDirectory()) throw new Error(`O caminho não é uma pasta: ${folder}`)
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
