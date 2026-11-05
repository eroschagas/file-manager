import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))
export const installerFiles = Object.freeze({
  win: 'File-Manager-Windows-x64-Setup.exe',
  mac: 'File-Manager-macOS-x64.dmg',
  linux: 'File-Manager-Linux-x64.AppImage',
})
