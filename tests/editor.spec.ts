import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __copyBlob?: Blob
    __downloadBlob?: Blob
  }
}

async function imageFile(page: Page, width: number, height: number, color: string) {
  const dataUrl = await page.evaluate(({ width, height, color }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png')
  }, { width, height, color })
  return { name: 'screenshot.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') }
}

async function loadByFilePicker(page: Page) {
  const file = await imageFile(page, 120, 90, '#ee4444')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher arquivo' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(file)
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
}

async function pasteImage(page: Page, width: number, height: number, color: string) {
  await page.evaluate(async ({ width, height, color }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, width, height)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'replacement.png', { type: 'image/png' }))
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }))
  }, { width, height, color })
}

async function dragRegion(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const bounds = await page.locator('canvas').boundingBox()
  if (!bounds) throw new Error('Canvas não encontrado')
  await page.mouse.move(bounds.x + bounds.width * x1, bounds.y + bounds.height * y1)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * x2, bounds.y + bounds.height * y2, { steps: 4 })
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
}

async function clickCanvas(page: Page, x: number, y: number) {
  const bounds = await page.locator('canvas').boundingBox()
  if (!bounds) throw new Error('Canvas não encontrado')
  await page.mouse.click(bounds.x + bounds.width * x, bounds.y + bounds.height * y)
}

async function pixel(page: Page, x: number, y: number) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement, point) =>
    [...canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data], { x, y })
}

async function captureExports(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: async (items: ClipboardItem[]) => { window.__copyBlob = await items[0].getType('image/png') } },
    })
    const createObjectURL = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob) window.__downloadBlob = blob
      return createObjectURL(blob)
    }
  })
}

test('remove a primeira tarja, preserva a segunda e integra desfazer/refazer', async ({ page }) => {
  await page.goto('/')
  await loadByFilePicker(page)
  await dragRegion(page, 0.1, 0.1, 0.35, 0.35)
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  await dragRegion(page, 0.6, 0.6, 0.9, 0.9)
  await page.getByRole('button', { name: 'Ocultar região' }).click()

  await clickCanvas(page, 0.2, 0.2)
  await expect(page.getByRole('button', { name: 'Remover ocultação' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover ocultação' }).click()
  expect((await pixel(page, 24, 18))[0]).toBeGreaterThan(200)
  expect(await pixel(page, 90, 70)).toEqual([0, 0, 0, 255])

  await page.getByRole('button', { name: 'Desfazer' }).click()
  expect(await pixel(page, 24, 18)).toEqual([0, 0, 0, 255])
  await page.getByRole('button', { name: 'Refazer' }).click()
  expect((await pixel(page, 24, 18))[0]).toBeGreaterThan(200)
})

test('em sobreposição, o clique escolhe a tarja aplicada por último', async ({ page }) => {
  await page.goto('/')
  await loadByFilePicker(page)
  await dragRegion(page, 0.1, 0.1, 0.7, 0.7)
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  await dragRegion(page, 0.4, 0.4, 0.9, 0.9)
  await page.getByRole('button', { name: 'Ocultar região' }).click()

  await clickCanvas(page, 0.5, 0.5)
  await page.getByRole('button', { name: 'Remover ocultação' }).click()
  expect(await pixel(page, 60, 45)).toEqual([0, 0, 0, 255])
  expect((await pixel(page, 100, 75))[0]).toBeGreaterThan(200)
})

test('seleciona a tarja correta mesmo com o canvas reduzido na tela', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const file = await imageFile(page, 1600, 1200, '#ee4444')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher arquivo' }).click()
  await (await chooserPromise).setFiles(file)
  await expect(page.locator('canvas')).toHaveAttribute('width', '1600')
  const bounds = await page.locator('canvas').boundingBox()
  expect(bounds!.width).toBeLessThan(1600)

  await dragRegion(page, 0.1, 0.1, 0.35, 0.35)
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  await dragRegion(page, 0.65, 0.65, 0.9, 0.9)
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  await clickCanvas(page, 0.2, 0.2)
  await page.getByRole('button', { name: 'Remover ocultação' }).click()
  expect((await pixel(page, 320, 240))[0]).toBeGreaterThan(200)
  expect(await pixel(page, 1200, 900)).toEqual([0, 0, 0, 255])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('Escape cancela a seleção, mas primeiro fecha o aviso de exportação', async ({ page }) => {
  await page.goto('/')
  await loadByFilePicker(page)
  await dragRegion(page, 0.2, 0.2, 0.5, 0.5)
  await page.getByRole('button', { name: 'Copiar imagem protegida' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
})

test('Escape fecha a confirmação de nova imagem e preserva a edição', async ({ page }) => {
  await page.goto('/')
  await loadByFilePicker(page)
  await dragRegion(page, 0.1, 0.1, 0.3, 0.3)
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  await dragRegion(page, 0.6, 0.6, 0.8, 0.8)
  await page.getByRole('button', { name: 'Nova imagem' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeEnabled()
  expect(await pixel(page, 24, 18)).toEqual([0, 0, 0, 255])
})

test('avisa antes de cada saída sem tarjas e executa somente a ação escolhida', async ({ page }) => {
  await page.goto('/')
  await loadByFilePicker(page)
  await captureExports(page)

  await page.getByRole('button', { name: 'Copiar imagem protegida' }).click()
  await expect(page.getByRole('dialog')).toContainText('Esta imagem ainda não possui informações ocultadas')
  await expect(page.getByRole('button', { name: 'Voltar à edição' })).toBeFocused()
  await page.getByRole('button', { name: 'Voltar à edição' }).click()
  expect(await page.evaluate(() => window.__copyBlob?.size ?? 0)).toBe(0)

  await page.getByRole('button', { name: 'Copiar imagem protegida' }).click()
  await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  await expect.poll(() => page.evaluate(() => window.__copyBlob?.size ?? 0)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.__downloadBlob?.size ?? 0)).toBe(0)

  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar à edição' }).click()
  expect(await page.evaluate(() => window.__downloadBlob?.size ?? 0)).toBe(0)

  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  await expect.poll(() => page.evaluate(() => window.__downloadBlob?.size ?? 0)).toBeGreaterThan(0)
})

test('exporta tarjas nos pixels sem aviso e limpa o estado ao substituir a imagem', async ({ page }) => {
  const requests: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`))
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text())
  })
  await page.goto('/')
  await loadByFilePicker(page)
  await captureExports(page)
  await dragRegion(page, 0.2, 0.2, 0.6, 0.6)
  await page.getByRole('button', { name: 'Ocultar região' }).click()

  await page.getByRole('button', { name: 'Copiar imagem protegida' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__copyBlob?.size ?? 0)).toBeGreaterThan(0)
  const protectedPixel = await page.evaluate(async () => {
    const bitmap = await createImageBitmap(window.__copyBlob!)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return [...context.getImageData(40, 35, 1, 1).data]
  })
  expect(protectedPixel).toEqual([0, 0, 0, 255])

  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__downloadBlob?.size ?? 0)).toBeGreaterThan(0)
  const downloadedPixel = await page.evaluate(async () => {
    const bitmap = await createImageBitmap(window.__downloadBlob!)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return [...context.getImageData(40, 35, 1, 1).data]
  })
  expect(downloadedPixel).toEqual([0, 0, 0, 255])

  await pasteImage(page, 80, 60, '#00aa66')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeEnabled()

  await pasteImage(page, 80, 60, '#00aa66')
  await page.getByRole('button', { name: 'Descartar e substituir' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '80')
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Remover ocultação' })).toHaveCount(0)
  expect(requests.every((request) => request.startsWith('GET http://127.0.0.1:5182/'))).toBe(true)

  await page.setViewportSize({ width: 375, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(consoleErrors).toEqual([])
})
