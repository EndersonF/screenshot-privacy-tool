import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __zoomExport?: Blob
    __zoomTouchEvents?: string[]
  }
}

const hide = (page: Page) => page.getByRole('button', { name: 'Ocultar região', exact: true })
const move = (page: Page) => page.getByRole('button', { name: 'Mover imagem', exact: true })

async function frames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function imageFile(page: Page, width: number, height: number, color = '#ee4444') {
  const data = await page.evaluate(({ width, height, color }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height, color })
  return { name: 'synthetic-zoom.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }
}

async function openImage(page: Page, width = 1200, height = 900) {
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('input[type=file]').setInputFiles(await imageFile(page, width, height))
  await expect(page.locator('canvas')).toHaveAttribute('width', String(width))
  await expect(page.locator('.image-viewport')).toBeVisible()
  await page.locator('canvas').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
  await frames(page)
}

async function geometry(page: Page) {
  return page.locator('.image-viewport').evaluate((viewport) => {
    const canvas = viewport.querySelector('canvas')!
    const bounds = viewport.getBoundingClientRect()
    const image = canvas.getBoundingClientRect()
    const left = bounds.left + viewport.clientLeft
    const top = bounds.top + viewport.clientTop
    return {
      left, top, width: viewport.clientWidth, height: viewport.clientHeight,
      scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop,
      maxLeft: viewport.scrollWidth - viewport.clientWidth,
      maxTop: viewport.scrollHeight - viewport.clientHeight,
      imageLeft: image.left, imageTop: image.top,
      imageWidth: image.width, imageHeight: image.height,
      originalWidth: canvas.width, originalHeight: canvas.height,
      scale: image.width / canvas.width,
      centerX: (left + viewport.clientWidth / 2 - image.left) / (image.width / canvas.width),
      centerY: (top + viewport.clientHeight / 2 - image.top) / (image.height / canvas.height),
    }
  })
}

async function amplify(page: Page, target: number) {
  for (let count = 0; count < 20; count += 1) {
    if ((await geometry(page)).scale >= target - 0.001) return
    const button = page.getByRole('button', { name: 'Ampliar', exact: true })
    await expect(button).toBeEnabled()
    await button.click()
    await frames(page)
  }
  throw new Error(`A escala não alcançou ${target}`)
}

async function scrollToPoint(page: Page, x: number, y: number, inset = 40) {
  await page.locator('.image-viewport').evaluate((viewport, point) => {
    const canvas = viewport.querySelector('canvas')!
    const image = canvas.getBoundingClientRect()
    const bounds = viewport.getBoundingClientRect()
    viewport.scrollLeft += image.left + point.x * image.width / canvas.width - bounds.left - viewport.clientLeft - point.inset
    viewport.scrollTop += image.top + point.y * image.height / canvas.height - bounds.top - viewport.clientTop - point.inset
  }, { x, y, inset })
  await frames(page)
}

async function selectOriginal(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const view = await geometry(page)
  const first = { x: view.imageLeft + x1 * view.scale, y: view.imageTop + y1 * view.scale }
  const last = { x: view.imageLeft + x2 * view.scale, y: view.imageTop + y2 * view.scale }
  for (const point of [first, last]) {
    expect(point.x).toBeGreaterThan(view.left)
    expect(point.y).toBeGreaterThan(view.top)
    expect(point.x).toBeLessThan(view.left + view.width)
    expect(point.y).toBeLessThan(view.top + view.height)
  }
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  await page.mouse.move(last.x, last.y, { steps: 4 })
  await page.mouse.up()
  await expect(hide(page)).toBeEnabled()
}

async function exports(page: Page) {
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob) window.__zoomExport = blob
      return create(blob)
    }
  })
}

async function png(page: Page, withoutRedactions = false) {
  await page.evaluate(() => { window.__zoomExport = undefined })
  const requested = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  if (withoutRedactions) await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  expect(await (await requested).failure()).toBeNull()
  await expect.poll(() => page.evaluate(() => window.__zoomExport?.size ?? 0)).toBeGreaterThan(0)
  return page.evaluate(async () => {
    const blob = window.__zoomExport!
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let left = canvas.width
    let top = canvas.height
    let right = -1
    let bottom = -1
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4
        if (pixels[index] === 0 && pixels[index + 1] === 0 && pixels[index + 2] === 0 && pixels[index + 3] === 255) {
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    }
    return {
      mime: blob.type, width: canvas.width, height: canvas.height,
      digest: [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))],
      black: right < 0 ? null : { left, top, right, bottom },
    }
  })
}

test('imagem pequena começa em 100%, respeita fator e limites e Ajustar recupera o enquadramento', async ({ page }) => {
  await openImage(page, 120, 90)
  const reduce = page.getByRole('button', { name: 'Reduzir', exact: true })
  const increase = page.getByRole('button', { name: 'Ampliar', exact: true })
  await expect(move(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(reduce).toBeDisabled()
  expect((await geometry(page)).scale).toBeCloseTo(1, 3)
  await expect(page.locator('.zoom-level')).toHaveText('100%')
  for (const scale of [1.5, 2.25, 3.375, 4]) {
    await increase.click()
    await expect.poll(async () => (await geometry(page)).scale).toBeCloseTo(scale, 3)
  }
  await expect(increase).toBeDisabled()
  expect((await geometry(page)).originalWidth).toBe(120)
  expect((await geometry(page)).originalHeight).toBe(90)
  await reduce.click()
  await expect.poll(async () => (await geometry(page)).scale).toBeCloseTo(4 / 1.5, 3)
  await page.getByRole('button', { name: 'Imagem inteira', exact: true }).click()
  await expect.poll(async () => (await geometry(page)).scale).toBeCloseTo(1, 3)
  await expect(reduce).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refazer', exact: true })).toBeDisabled()
})

test('ampliar e reduzir preservam o centro e os quatro cantos permanecem alcançáveis', async ({ page }) => {
  await openImage(page)
  const fitted = await geometry(page)
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click()
  await frames(page)
  const firstZoom = await geometry(page)
  // A rolagem nativa arredonda posições; tolerância de até um pixel CSS.
  expect(Math.abs(firstZoom.centerX - fitted.centerX) * firstZoom.scale).toBeLessThanOrEqual(1)
  expect(Math.abs(firstZoom.centerY - fitted.centerY) * firstZoom.scale).toBeLessThanOrEqual(1)
  await amplify(page, 1)
  await scrollToPoint(page, 500, 350, 150)
  const before = await geometry(page)
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click()
  await frames(page)
  const enlarged = await geometry(page)
  expect(Math.abs(enlarged.centerX - before.centerX) * enlarged.scale).toBeLessThanOrEqual(1)
  expect(Math.abs(enlarged.centerY - before.centerY) * enlarged.scale).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Reduzir', exact: true }).click()
  await frames(page)
  const reduced = await geometry(page)
  expect(Math.abs(reduced.centerX - before.centerX) * reduced.scale).toBeLessThanOrEqual(1)
  expect(Math.abs(reduced.centerY - before.centerY) * reduced.scale).toBeLessThanOrEqual(1)
  await amplify(page, 4)
  for (const [horizontal, vertical] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    await page.locator('.image-viewport').evaluate((viewport, end) => {
      viewport.scrollTo(end.horizontal ? viewport.scrollWidth : 0, end.vertical ? viewport.scrollHeight : 0)
    }, { horizontal, vertical })
    await frames(page)
    const view = await geometry(page)
    const cornerX = horizontal ? view.imageLeft + view.imageWidth : view.imageLeft
    const cornerY = vertical ? view.imageTop + view.imageHeight : view.imageTop
    expect(cornerX).toBeGreaterThanOrEqual(view.left - 1)
    expect(cornerX).toBeLessThanOrEqual(view.left + view.width + 1)
    expect(cornerY).toBeGreaterThanOrEqual(view.top - 1)
    expect(cornerY).toBeLessThanOrEqual(view.top + view.height + 1)
  }
  await page.getByRole('button', { name: 'Imagem inteira', exact: true }).click()
  await frames(page)
  const fit = await geometry(page)
  expect(fit.imageWidth).toBeLessThanOrEqual(fit.width + 1)
  expect(fit.imageHeight).toBeLessThanOrEqual(fit.height + 1)
  expect(fit.centerX).toBeCloseTo(fit.originalWidth / 2, 0)
  expect(fit.centerY).toBeCloseTo(fit.originalHeight / 2, 0)
})

for (const scale of [1, 4]) {
  test(`seleção após rolagem em ${scale === 1 ? 'escala intermediária' : '400%'} exporta coordenadas originais e preserva remoção/histórico`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await openImage(page, 1600, 1200)
    await exports(page)
    await amplify(page, scale)
    await scrollToPoint(page, 700.25, 500.25)
    const view = await geometry(page)
    expect(view.scrollLeft).toBeGreaterThan(0)
    expect(view.scrollTop).toBeGreaterThan(0)
    await selectOriginal(page, 700.25, 500.25, 740.75, 525.75)
    await hide(page).click()
    const first = await png(page)
    expect({ mime: first.mime, width: first.width, height: first.height }).toEqual({ mime: 'image/png', width: 1600, height: 1200 })
    expect(first.black).toEqual({ left: 700, top: 500, right: 740, bottom: 525 })

    await page.getByRole('button', { name: 'Imagem inteira', exact: true }).click()
    await amplify(page, 4)
    await scrollToPoint(page, 700.25, 500.25)
    const zoomed = await geometry(page)
    await page.mouse.click(zoomed.imageLeft + 720 * zoomed.scale, zoomed.imageTop + 513 * zoomed.scale)
    await expect(page.getByRole('button', { name: 'Remover ocultação', exact: true })).toBeEnabled()
    expect(await png(page)).toEqual(first)
    await page.getByRole('button', { name: 'Remover ocultação', exact: true }).click()
    expect((await png(page, true)).black).toBeNull()
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    expect(await png(page)).toEqual(first)
    await page.getByRole('button', { name: 'Refazer', exact: true }).click()
    expect((await png(page, true)).black).toBeNull()
  })
}

for (const pointerType of ['mouse', 'pen'] as const) {
  test(`Mover com ${pointerType} preserva seleção pendente e somente confirmar altera a exportação`, async ({ page }) => {
    await openImage(page)
    await exports(page)
    await amplify(page, 4)
    await scrollToPoint(page, 500.25, 350.25)
    await selectOriginal(page, 500.25, 350.25, 540.75, 375.75)
    const pending = await png(page, true)
    expect(pending.black).toBeNull()
    await move(page).click()
    await expect(move(page)).toHaveAttribute('aria-pressed', 'true')
    const initial = await geometry(page)
    const session = await page.context().newCDPSession(page)
    const start = { x: initial.left + initial.width / 2, y: initial.top + initial.height / 2 }
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start, pointerType, buttons: 0 })
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, pointerType, button: 'left', buttons: 1 })
    await expect(move(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Ampliar', exact: true })).toBeDisabled()
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x - 60, y: start.y - 50, pointerType, buttons: 1 })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: start.x - 60, y: start.y - 50, pointerType, button: 'left', buttons: 0 })
    await expect(move(page)).toBeEnabled()
    const panned = await geometry(page)
    expect(panned.scrollLeft).toBeGreaterThan(initial.scrollLeft + 40)
    expect(panned.scrollTop).toBeGreaterThan(initial.scrollTop + 30)
    await expect(hide(page)).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
    expect(await png(page, true)).toEqual(pending)
    await page.getByRole('button', { name: 'Imagem inteira', exact: true }).click()
    await expect(move(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(hide(page)).toBeEnabled()
    await move(page).click()
    await hide(page).click()
    const applied = await png(page)
    expect(applied.black).toEqual({ left: 500, top: 350, right: 540, bottom: 375 })
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    expect(await png(page, true)).toEqual(pending)
  })
}

test('controles e área rolável funcionam pelo teclado sem criar anúncios ou edições de navegação', async ({ page }) => {
  await openImage(page)
  const increase = page.getByRole('button', { name: 'Ampliar', exact: true })
  await increase.focus()
  const initial = (await geometry(page)).scale
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await geometry(page)).scale).toBeGreaterThan(initial)
  await amplify(page, 4)
  const viewport = page.getByRole('region', { name: 'Visualização da imagem', exact: true })
  await viewport.focus()
  await expect(viewport).toBeFocused()
  const before = await geometry(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => (await geometry(page)).scrollLeft).toBeGreaterThan(before.scrollLeft)
  await expect.poll(async () => (await geometry(page)).scrollTop).toBeGreaterThan(before.scrollTop)
  await move(page).focus()
  await page.keyboard.press('Space')
  await expect(move(page)).toHaveAttribute('aria-pressed', 'true')
  expect(await move(page).evaluate((button) => button.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Space')
  await expect(move(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('status')).toHaveCount(1)
  expect(await page.locator('.zoom-controls').evaluate((element) => element.closest('[aria-live], [role=status]'))).toBeNull()
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
})

test('cancelar substituição mantém zoom, modo, seleção e histórico; confirmar reinicia a visualização', async ({ page }) => {
  await openImage(page)
  await amplify(page, 4)
  await scrollToPoint(page, 500.25, 350.25)
  await selectOriginal(page, 500.25, 350.25, 540.75, 375.75)
  await hide(page).click()
  await selectOriginal(page, 550.25, 390.25, 570.75, 405.75)
  await move(page).click()
  const before = await geometry(page)
  const replacement = await imageFile(page, 120, 90, '#00aa66')
  await page.locator('input[type=file]').setInputFiles(replacement)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(await geometry(page)).toEqual(before)
  await expect(move(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(hide(page)).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeEnabled()
  await page.locator('input[type=file]').setInputFiles(replacement)
  await page.getByRole('button', { name: 'Descartar e substituir', exact: true }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
  await expect.poll(async () => (await geometry(page)).scale).toBeCloseTo(1, 3)
  await expect(move(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(hide(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refazer', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Nova imagem', exact: true }).click()
  await expect(page.locator('.zoom-controls')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Escolher arquivo', exact: true })).toBeVisible()
})

test('redimensionar acompanha Ajustar, preserva escala manual e cancela apenas o arraste ativo', async ({ page }) => {
  await openImage(page)
  const initial = await geometry(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await geometry(page)).scale).toBeLessThan(initial.scale)
  await amplify(page, 4)
  await scrollToPoint(page, 500.25, 350.25)
  await selectOriginal(page, 500.25, 350.25, 540.75, 375.75)
  await hide(page).click()
  const view = await geometry(page)
  await page.mouse.move(view.left + 40, view.top + 40)
  await page.mouse.down()
  await page.mouse.move(view.left + 90, view.top + 80)
  await expect(page.getByRole('button', { name: 'Ampliar', exact: true })).toBeDisabled()
  await expect(move(page)).toBeDisabled()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(hide(page)).toBeDisabled()
  await page.mouse.up()
  await expect(move(page)).toBeEnabled()
  expect((await geometry(page)).scale).toBeCloseTo(4, 3)
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeEnabled()
  await expect(page.getByRole('status')).toContainText('cancelada')
  await exports(page)
  expect((await png(page)).black).toEqual({ left: 500, top: 350, right: 540, bottom: 375 })
})

test('resize de canvas centralizado para área com rolagem preserva o centro original', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openImage(page, 600, 400)
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click()
  await frames(page)
  const before = await geometry(page)
  expect(before.scale).toBeCloseTo(1.5, 3)
  expect(before.centerX).toBeCloseTo(300, 0)
  expect(before.centerY).toBeCloseTo(200, 0)
  expect(before.maxLeft).toBe(0)
  expect(before.maxTop).toBe(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await geometry(page)).maxLeft).toBeGreaterThan(0)
  await frames(page)
  const after = await geometry(page)
  expect(after.scale).toBeCloseTo(1.5, 3)
  expect(Math.abs(after.centerX - before.centerX)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.centerY - before.centerY)).toBeLessThanOrEqual(1)
})

test('resize na borda preserva o enquadramento mais próximo permitido sem trocar a escala', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openImage(page, 600, 400)
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click()
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click()
  await page.locator('.image-viewport').evaluate((viewport) => {
    viewport.scrollTo(viewport.scrollWidth, viewport.scrollHeight)
  })
  await frames(page)
  const before = await geometry(page)
  expect(before.maxLeft).toBeGreaterThan(0)
  expect(before.scrollLeft).toBe(before.maxLeft)
  await page.setViewportSize({ width: 760, height: 844 })
  await expect.poll(async () => (await geometry(page)).width).toBeGreaterThan(before.width)
  await frames(page)
  const after = await geometry(page)
  expect(after.scale).toBeCloseTo(before.scale, 3)
  expect(after.maxLeft).toBeGreaterThan(0)
  expect(Math.abs(after.scrollLeft - after.maxLeft)).toBeLessThanOrEqual(1)
  // O centro só pode mudar o necessário para respeitar as novas bordas.
  for (const axis of ['X', 'Y'] as const) {
    const size = axis === 'X' ? after.width : after.height
    const original = axis === 'X' ? after.originalWidth : after.originalHeight
    const half = size / (2 * after.scale)
    const previous = axis === 'X' ? before.centerX : before.centerY
    const actual = axis === 'X' ? after.centerX : after.centerY
    const expected = original <= 2 * half ? original / 2 : Math.max(half, Math.min(original - half, previous))
    expect(Math.abs(actual - expected) * after.scale).toBeLessThanOrEqual(1)
  }
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refazer', exact: true })).toBeDisabled()
})

for (const image of [{ width: 390, height: 2500 }, { width: 4000, height: 500 }, { width: 4000, height: 3000 }]) {
  test(`imagem ${image.width}x${image.height} ajusta por inteiro sem mudar o bitmap ao ampliar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openImage(page, image.width, image.height)
    const fit = await geometry(page)
    expect(fit.scale).toBeLessThanOrEqual(1)
    expect(fit.imageWidth).toBeLessThanOrEqual(fit.width + 1)
    expect(fit.imageHeight).toBeLessThanOrEqual(fit.height + 1)
    await amplify(page, 4)
    const enlarged = await geometry(page)
    expect(enlarged.originalWidth).toBe(image.width)
    expect(enlarged.originalHeight).toBe(image.height)
    expect(enlarged.scale).toBeCloseTo(4, 3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`controles não cobrem a imagem nem causam overflow em ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await openImage(page)
    for (const enlarged of [false, true]) {
      if (enlarged) await amplify(page, 4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const viewport = await geometry(page)
      expect(viewport.height).toBeGreaterThan(50)
      for (const name of ['Ampliar', 'Reduzir', 'Imagem inteira', 'Mover imagem']) {
        const button = page.getByRole('button', { name, exact: true })
        await expect(button).toBeInViewport()
        const bounds = (await button.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width + 1)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.top + 1)
      }
      await expect(page.getByRole('status')).toHaveCount(1)
    }
  })
}

test.describe('navegação nativa por toque emulada no Chromium', () => {
  // O CDP não representa a rolagem, a inércia e o touch-action do Safari físico.
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })

  test('um dedo move sem apagar a seleção pendente ao navegador assumir o gesto', async ({ page }) => {
    await openImage(page)
    await amplify(page, 4)
    await scrollToPoint(page, 500.25, 350.25)
    await selectOriginal(page, 500.25, 350.25, 540.75, 375.75)
    await move(page).click()
    await page.evaluate(() => {
      window.__zoomTouchEvents = []
      window.addEventListener('pointercancel', (event) => {
        if (event.pointerType === 'touch') window.__zoomTouchEvents!.push(event.type)
      }, true)
    })
    const session = await page.context().newCDPSession(page)
    // Gestos separados respeitam o bloqueio direcional nativo do navegador.
    for (const axis of ['horizontal', 'vertical']) {
      const view = await geometry(page)
      const start = { x: Math.round(view.left + view.width * 0.75), y: Math.round(view.top + view.height * 0.75) }
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...start }] })
      for (let step = 1; step <= 6; step += 1) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{
            id: 1,
            x: start.x - (axis === 'horizontal' ? step * 12 : 0),
            y: start.y - (axis === 'vertical' ? step * 12 : 0),
          }]
        })
      }
      // pointercancel transfere o gesto ao navegador; o dedo ainda está na tela.
      await expect(page.getByRole('button', { name: 'Imagem inteira', exact: true })).toBeDisabled()
      await expect(move(page)).toBeDisabled()
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect(move(page)).toBeEnabled()
      await expect.poll(async () => {
        const current = await geometry(page)
        return axis === 'horizontal' ? current.scrollLeft - view.scrollLeft : current.scrollTop - view.scrollTop
      }).toBeGreaterThan(10)
    }
    expect(await page.evaluate(() => window.__zoomTouchEvents)).toContain('pointercancel')
    await expect(hide(page)).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
    await expect(move(page)).toHaveAttribute('aria-pressed', 'true')
    await move(page).click()
    await hide(page).click()
    await exports(page)
    expect((await png(page)).black).toEqual({ left: 500, top: 350, right: 540, bottom: 375 })
  })
})
