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
    await expect(page.getByRole('heading', { name: 'Por onde vamos começar?' })).toBeVisible()
    await page.screenshot({ path: '.test-output/setup.png', fullPage: true })
    await page.getByLabel('Pasta para análise').fill(join(directory, 'nonexistent'))
    await page.getByRole('button', { name: 'Analisar arquivos' }).click()
    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Por onde vamos começar?' })).toBeVisible()
    await page.getByLabel('Pasta para análise').fill(directory)
    await page.getByRole('button', { name: '+ Adicionar pasta', exact: true }).click()
    await page.getByLabel('Pasta para análise 2', { exact: true }).fill(nested)
    await page.getByRole('button', { name: 'Remover pasta 2', exact: true }).click()
    await expect(page.getByLabel('Pasta para análise', { exact: true })).toHaveValue(directory)
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
      },
      [directory, nested],
    )
    await page.getByRole('button', { name: 'Procurar pasta', exact: true }).click()
    await expect(page.getByLabel('Pasta para análise 2', { exact: true })).toHaveValue(nested)
    await page.getByRole('button', { name: 'Analisar arquivos' }).click()
    await expect(page.getByText('Análise concluída')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.group-list__item')).toHaveCount(2)
    await expect(page.locator('.media-card')).toHaveCount(2)
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
    await page.getByRole('button', { name: 'Ampliar imagem' }).first().click()
    await expect(page.locator('dialog')).toBeVisible()
    await expect
      .poll(() =>
        page.locator('dialog img').evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBe(640)
    await assertFileReleased(join(directory, 'original.jpg'))
    await page.getByRole('button', { name: 'Fechar imagem' }).click()
    const requestsBeforeSelection = originalRequests.length
    await page.locator('.media-card input').first().check()
    expect(originalRequests).toHaveLength(requestsBeforeSelection)
    await assertFileReleased(join(directory, 'original.jpg'))
    await assertFileReleased(join(directory, 'copy.jpeg'))
    await expect(page.locator('.media-card input').nth(1)).toBeDisabled()
    await page.screenshot({ path: '.test-output/comparison.png', fullPage: true })
    const guardError = await page.evaluate(async () => {
      const ids = await new Promise<string[]>((resolve) => {
        // IDs are opaque and sourced from the preview URLs shown in this group.
        resolve(
          [...document.querySelectorAll<HTMLImageElement>('.media-card img')].map((image) =>
            new URL(image.src).pathname.slice(1),
          ),
        )
      })
      try {
        await window.desktop.trashFiles(ids)
        return ''
      } catch (error) {
        return String(error)
      }
    })
    expect(guardError).toContain('Mantenha pelo menos um arquivo')
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    })
    await page.getByRole('button', { name: 'Enviar à lixeira', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Enviar à lixeira', exact: true })).toBeEnabled()
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
    await page.getByRole('button', { name: 'Enviar à lixeira', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('original.jpg')
    await expect(page.getByRole('status')).toContainText('O Windows interrompeu')
    await expect(page.locator('.media-card input').first()).toBeChecked()
    await access(join(directory, 'original.jpg'))
    await page.getByRole('button', { name: 'Enviar à lixeira', exact: true }).click()
    await expect(page.locator('.group-list__item')).toHaveCount(1)
    await expect(page.getByRole('status')).toContainText('1 arquivo(s) enviado(s)')
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
    await page.getByRole('button', { name: 'Reproduzir vídeo' }).first().click()
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
    await page.getByRole('button', { name: 'Enviar à lixeira', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Tudo revisado por aqui.' })).toBeVisible()
    await access(join(nested, 'video-copy.mp4'))
    expect(errors).toEqual([])
  } finally {
    await app.close()
    await rm(directory, { recursive: true, force: true })
  }
})
