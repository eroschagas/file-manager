import { _electron as electron, expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const assertFileReleased = async (path: string): Promise<void> => {
  if (process.platform !== 'win32') return
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$ErrorActionPreference = 'Stop'; $handle = [System.IO.File]::Open($env:MEDIA_LOCK_TEST_PATH, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None); $handle.Dispose()",
    ],
    { windowsHide: true, env: { ...process.env, MEDIA_LOCK_TEST_PATH: path } },
  )
}

test('desktop: recursive scan, previews, selection safeguards and trash confirmation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'file-manager-desktop-'))
  const nested = join(directory, 'nested')
  await mkdir(nested)
  const image = Buffer.from(
    '<svg width="640" height="480"><rect width="640" height="480" fill="#e4c398"/><circle cx="180" cy="180" r="100" fill="#326a8c"/><path d="M280 410 L430 50 L600 410Z" fill="#c45969"/></svg>',
  )
  await sharp(image).jpeg({ quality: 95 }).toFile(join(directory, 'original.jpg'))
  await sharp(image).resize(320, 240).jpeg({ quality: 50 }).toFile(join(directory, 'copy.jpeg'))
  const run = promisify(execFile)
  await run(
    ffmpegPath!,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x240:rate=10:duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      join(directory, 'video.mp4'),
    ],
    { windowsHide: true },
  )
  await run(
    ffmpegPath!,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      join(directory, 'video.mp4'),
      '-vf',
      'scale=160:120',
      '-c:v',
      'libx264',
      '-crf',
      '35',
      join(nested, 'video-copy.mp4'),
    ],
    { windowsHide: true },
  )
  const electronEnv: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && entry[0] !== 'ELECTRON_RUN_AS_NODE',
      ),
    ),
    ELECTRON_RENDERER_URL: '',
  }
  const app = await electron.launch({
    ...(process.env.FILE_MANAGER_EXECUTABLE
      ? { executablePath: process.env.FILE_MANAGER_EXECUTABLE, args: [] }
      : { args: ['.'] }),
    env: electronEnv,
  })
  try {
    const page = await app.firstWindow()
    const errors: string[] = []
    const originalRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().startsWith('media://original/')) originalRequests.push(request.url())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await expect(page.getByRole('heading', { name: 'Where should we start?' })).toBeVisible()
    await expect(page.getByLabel('Similarity', { exact: true })).toHaveValue('balanced')
    await page.getByLabel('Similarity', { exact: true }).selectOption('flexible')
    await expect(
      page.getByText(
        'Finds more candidates, but may group different photos together. Review each group before deleting.',
      ),
    ).toBeVisible()
    await page.screenshot({ path: '.test-output/setup.png', fullPage: true })
    await page.getByLabel('Folder to scan').fill(join(directory, 'nonexistent'))
    await page.getByRole('button', { name: 'Scan files' }).click()
    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Where should we start?' })).toBeVisible()
    await page.getByLabel('Folder to scan').fill(directory)
    await page.getByRole('button', { name: '+ Add folder', exact: true }).click()
    await page.getByLabel('Folder to scan 2', { exact: true }).fill(nested)
    await page.getByRole('button', { name: 'Remove folder 2', exact: true }).click()
    await expect(page.getByLabel('Folder to scan', { exact: true })).toHaveValue(directory)
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
      },
      [directory, nested],
    )
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    await expect(page.getByLabel('Folder to scan 2', { exact: true })).toHaveValue(nested)
    await page.getByRole('button', { name: 'Scan files' }).click()
    await expect(page.getByText('Scan complete')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.group-list__item')).toHaveCount(2)
    await page.locator('.group-list__item').filter({ hasText: 'Photos' }).click()
    await expect(page.locator('.media-card')).toHaveCount(2)
    await expect(page.locator('.media-card input').nth(1)).toBeChecked()
    await expect(page.locator('.media-card input').first()).not.toBeChecked()
    await page.locator('.media-card input').first().check()
    await expect(page.locator('.media-card input').nth(1)).toBeChecked()
    await expect(page.locator('.group-list__item--active .group-list__selected-count')).toHaveText(
      '2',
    )
    await page.locator('.media-card input').first().uncheck()
    await expect(page.locator('.media-card input').first()).not.toBeChecked()
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
    await expect(page.locator('.group-list__item--active .group-list__selected-count')).toHaveText(
      '0',
    )
    const scrollState = await page.evaluate(() => {
      const detail = document.querySelector<HTMLElement>('.group-detail')!
      const groups = document.querySelector<HTMLElement>('.group-list__items')!
      const groupScroll = groups.scrollTop
      const groupTop = groups.getBoundingClientRect().top
      detail.scrollTop = detail.scrollHeight
      return {
        detailScroll: detail.scrollTop,
        groupScrollUnchanged: groups.scrollTop === groupScroll,
        groupPositionUnchanged: groups.getBoundingClientRect().top === groupTop,
        headerTop: document.querySelector('.app-header')!.getBoundingClientRect().top,
      }
    })
    expect(scrollState.detailScroll).toBeGreaterThan(0)
    expect(scrollState.groupScrollUnchanged).toBe(true)
    expect(scrollState.groupPositionUnchanged).toBe(true)
    expect(scrollState.headerTop).toBe(0)
    await expect
      .poll(() =>
        page
          .locator('.media-card img')
          .first()
          .evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0)
    expect(originalRequests).toHaveLength(0)
    await assertFileReleased(join(directory, 'original.jpg'))
    await assertFileReleased(join(directory, 'copy.jpeg'))
    await page.getByRole('button', { name: 'Enlarge image' }).first().click()
    await expect(page.locator('dialog')).toBeVisible()
    await expect
      .poll(() =>
        page.locator('dialog img').evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBe(640)
    await assertFileReleased(join(directory, 'original.jpg'))
    await page.getByRole('button', { name: 'Close image' }).click()
    const requestsBeforeSelection = originalRequests.length
    await page.locator('.media-card input').first().check()
    expect(originalRequests).toHaveLength(requestsBeforeSelection)
    await assertFileReleased(join(directory, 'original.jpg'))
    await assertFileReleased(join(directory, 'copy.jpeg'))
    await expect(page.locator('.media-card input').nth(1)).toBeEnabled()
    await expect(page.locator('.media-card input').nth(1)).not.toBeChecked()
    await page.screenshot({ path: '.test-output/comparison.png', fullPage: true })
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async (...args: unknown[]) => {
        const options = args[args.length - 1] as Electron.MessageBoxOptions
        if (!options.detail?.includes('All files in 1 group(s) are selected.'))
          throw new Error('Missing all-files confirmation detail')
        return { response: 0, checkboxChecked: false }
      }
    })
    const cancelledAll = await page.evaluate(async () => {
      const ids = await new Promise<string[]>((resolve) => {
        // IDs are opaque and sourced from the preview URLs shown in this group.
        resolve(
          [...document.querySelectorAll<HTMLImageElement>('.media-card img')].map((image) =>
            new URL(image.src).pathname.slice(1),
          ),
        )
      })
      return window.desktop.trashFiles(ids)
    })
    expect(cancelledAll).toEqual({ deletedIds: [], errors: [] })
    await access(join(directory, 'original.jpg'))
    await access(join(directory, 'copy.jpeg'))
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    })
    await page.getByRole('button', { name: 'Move to Recycle Bin', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Move to Recycle Bin', exact: true }),
    ).toBeEnabled()
    await expect(page.locator('.group-list__item')).toHaveCount(2)
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    await app.evaluate(({ shell }) => {
      const trashItem = shell.trashItem.bind(shell)
      let abortOnce = true
      shell.trashItem = async (path) => {
        if (abortOnce) {
          abortOnce = false
          throw new Error('Operation was aborted')
        }
        await trashItem(path)
      }
    })
    await page.getByRole('button', { name: 'Move to Recycle Bin', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('original.jpg')
    await expect(page.getByRole('status')).toContainText('Windows interrupted')
    await expect(page.locator('.media-card input').first()).toBeChecked()
    await access(join(directory, 'original.jpg'))
    await page.getByRole('button', { name: 'Move to Recycle Bin', exact: true }).click()
    await expect(page.locator('.group-list__item')).toHaveCount(1)
    await expect(page.getByRole('status')).toContainText('1 file(s) moved')
    // The selected original is a generated temporary fixture; its other version must remain.
    await expect
      .poll(async () => {
        try {
          await access(join(directory, 'original.jpg'))
          return true
        } catch {
          return false
        }
      })
      .toBe(false)
    await access(join(directory, 'copy.jpeg'))
    await expect(page.locator('video')).toHaveCount(0)
    const requestsBeforeVideo = originalRequests.length
    await page.locator('.media-card input').first().check()
    expect(originalRequests).toHaveLength(requestsBeforeVideo)
    await page.getByRole('button', { name: 'Play video' }).first().click()
    await expect(page.locator('video')).toHaveCount(1)
    await page
      .locator('video')
      .first()
      .evaluate((node) => (node as HTMLVideoElement).load())
    await expect
      .poll(() =>
        page
          .locator('video')
          .first()
          .evaluate((node) => (node as HTMLVideoElement).readyState),
      )
      .toBeGreaterThan(0)
    await page
      .locator('video')
      .first()
      .evaluate((node) => (node as HTMLVideoElement).play())
    await page.locator('.media-card input').first().check()
    await page.locator('.media-card input').nth(1).check()
    await expect(page.locator('.group-list__item--active .group-list__selected-count')).toHaveText(
      '2',
    )
    await page.getByRole('button', { name: 'Move to Recycle Bin', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'All reviewed here.' })).toBeVisible()
    await expect
      .poll(async () => {
        try {
          await access(join(nested, 'video-copy.mp4'))
          return true
        } catch {
          return false
        }
      })
      .toBe(false)
    await page.getByRole('button', { name: 'Scan another folder', exact: true }).click()
    await expect(page.locator('.folder-form input')).toHaveCount(1)
    await expect(page.getByLabel('Folder to scan', { exact: true })).toHaveValue('')
    // Inspect defaultPath through a cancelled dialog, then verify single-folder memory.
    await app.evaluate(({ dialog }, expected) => {
      dialog.showOpenDialog = async (...args: unknown[]) => {
        const options = args[args.length - 1] as Electron.OpenDialogOptions
        if (options.defaultPath !== expected)
          throw new Error(`Unexpected picker directory: ${options.defaultPath}`)
        return { canceled: true, filePaths: [] }
      }
    }, directory)
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    await expect(page.getByLabel('Folder to scan', { exact: true })).toHaveValue('')
    await app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] })
    }, nested)
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    await expect(page.getByLabel('Folder to scan', { exact: true })).toHaveValue(nested)
    await app.evaluate(({ dialog }, expected) => {
      dialog.showOpenDialog = async (...args: unknown[]) => {
        const options = args[args.length - 1] as Electron.OpenDialogOptions
        if (options.defaultPath !== expected)
          throw new Error(`Unexpected picker directory: ${options.defaultPath}`)
        return { canceled: true, filePaths: [] }
      }
    }, directory)
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    await expect(page.getByLabel('Folder to scan', { exact: true })).toHaveValue(nested)
    await expect(page.getByRole('status')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})
