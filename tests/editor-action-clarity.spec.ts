import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const REVIEW = 'Antes de compartilhar, confira se ocultou todas as informações necessárias.'
const READY = 'Arraste na imagem para selecionar.'
const CONFIRM = 'Confirme em “Ocultar região”.'

async function openImage(page: Page) {
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 960
    canvas.height = 720
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ee4444'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })
  await expect(page.locator('canvas')).toBeVisible()
  await page.locator('canvas').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
}

async function selectRegion(page: Page, x1 = 0.1, y1 = 0.1, x2 = 0.35, y2 = 0.35) {
  const before = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(before.x + before.width * x1, before.y + before.height * y1)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width * x2, before.y + before.height * y2, { steps: 4 })
  await expect(page.getByRole('button', { name: 'Ocultar região', exact: true })).toBeEnabled()
  // A instrução muda durante pointermove: não pode alterar a geometria do gesto.
  expect(await page.locator('canvas').boundingBox()).toEqual(before)
  await page.mouse.up()
}

async function pixel(page: Page, x: number, y: number) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement, point) =>
    [...canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data], { x, y })
}

async function visibleWithin(element: Locator, width: number, height: number) {
  await expect(element).toBeVisible()
  const bounds = (await element.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1)
  return bounds
}

async function checkLayout(page: Page, width: number, height: number) {
  expect(await page.evaluate(() => scrollY)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const toolbar = await visibleWithin(page.locator('.topbar'), width, height)
  const buttons = await page.locator('.topbar button').all()
  const bounds = []
  for (const button of buttons) bounds.push(await visibleWithin(button, width, height))
  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i]
      const b = bounds[j]
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
      expect(overlaps, `botões ${i} e ${j} não devem se sobrepor`).toBe(false)
    }
  }
  const hint = await visibleWithin(page.locator('.selection-hint'), width, height)
  const hide = (await page.getByRole('button', { name: 'Ocultar região', exact: true }).boundingBox())!
  const hintGap = width > 1100
    ? hint.y - (hide.y + hide.height)
    : hide.y - (hint.y + hint.height)
  expect(hintGap).toBeGreaterThanOrEqual(0)
  expect(hintGap).toBeLessThanOrEqual(9)
  const canvas = await visibleWithin(page.locator('canvas'), width, height)
  expect(canvas.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height)
  const footer = (await page.locator('.statusbar').boundingBox())!
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(footer.y + 1)
  await expect(page.locator('.feedback__text')).toHaveCSS('opacity', '1')
  await visibleWithin(page.locator('.feedback__text'), width, height)
  if (await page.locator('.export-hint').count()) {
    const review = await visibleWithin(page.locator('.export-hint'), width, height)
    const actions = (await page.getByRole('group', { name: 'Exportação' }).boundingBox())!
    expect(review.y - (actions.y + actions.height)).toBeGreaterThanOrEqual(0)
    expect(review.y - (actions.y + actions.height)).toBeLessThanOrEqual(5)
  }
}

test('a instrução acompanha a seleção e exige o único botão de confirmação', async ({ page }) => {
  await openImage(page)
  const hide = page.getByRole('button', { name: 'Ocultar região', exact: true })
  const hint = page.locator('.selection-hint')
  const review = page.locator('.export-hint')
  await expect(hide).toHaveCount(1)
  await expect(hide).toBeDisabled()
  await expect(hint).toHaveText(READY)
  await expect(review).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(1)

  await selectRegion(page)
  await expect(hide).toHaveCount(1)
  await expect(hint).toHaveText(CONFIRM)
  await expect(hide).toHaveAccessibleDescription(CONFIRM)
  await expect(hide).toHaveCSS('background-color', 'rgb(0, 113, 227)')
  expect((await pixel(page, 200, 150))[0]).toBeGreaterThan(150)
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(hide).toBeDisabled()
  await expect(hint).toHaveText(READY)
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
  expect(await pixel(page, 200, 150)).toEqual([238, 68, 68, 255])

  await selectRegion(page)
  await page.getByRole('button', { name: 'Nova imagem', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(hide).toBeFocused()
  expect(await hide.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Enter')
  await expect(hide).toBeDisabled()
  expect(await pixel(page, 200, 150)).toEqual([0, 0, 0, 255])
  await expect(hint).toHaveText(READY)
  await expect(review).toHaveText(REVIEW)
  await expect(page.getByRole('group', { name: 'Exportação' })).toHaveAccessibleDescription(REVIEW)
  await expect(page.getByRole('status')).toHaveText('Região ocultada.')
  for (const instruction of [hint, review]) {
    expect(await instruction.evaluate((element) =>
      element.closest('[aria-hidden="true"], [role="status"], [aria-live]:not([aria-live="off"])') === null)).toBe(true)
  }

  await selectRegion(page, 0.6, 0.6, 0.9, 0.9)
  await hide.click()
  await expect(review).toHaveCount(1)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(review).toHaveText(REVIEW)
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect(review).toHaveCount(0)
  await page.getByRole('button', { name: 'Refazer', exact: true }).click()
  await expect(review).toHaveText(REVIEW)
  const canvas = (await page.locator('canvas').boundingBox())!
  await page.mouse.click(canvas.x + canvas.width * 0.2, canvas.y + canvas.height * 0.2)
  await page.getByRole('button', { name: 'Remover ocultação', exact: true }).click()
  await expect(review).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Exportação' })).not.toHaveAttribute('aria-describedby')
})

for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 760, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`confirmação e revisão ficam próximas das ações em ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await openImage(page)
    await checkLayout(page, width, height)
    await selectRegion(page)
    await checkLayout(page, width, height)
    await page.getByRole('button', { name: 'Ocultar região', exact: true }).click()
    await checkLayout(page, width, height)
    // A orientação e a ação também cabem quando já há tarjas e uma nova seleção.
    await selectRegion(page, 0.6, 0.6, 0.9, 0.9)
    await checkLayout(page, width, height)
    await page.getByRole('button', { name: 'Ocultar região', exact: true }).click()
    const canvas = (await page.locator('canvas').boundingBox())!
    await page.mouse.click(canvas.x + canvas.width * 0.2, canvas.y + canvas.height * 0.2)
    await expect(page.getByRole('button', { name: 'Remover ocultação', exact: true })).toBeVisible()
    await checkLayout(page, width, height)
    const selectedCanvas = (await page.locator('canvas').boundingBox())!
    await page.mouse.click(selectedCanvas.x + selectedCanvas.width * 0.5, selectedCanvas.y + selectedCanvas.height * 0.5)
    const requested = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
    const png = await requested
    expect(await png.failure()).toBeNull()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Download do PNG com ocultações solicitado ao navegador.')
    await checkLayout(page, width, height)
    await visibleWithin(page.locator('.download-help summary'), width, height)
    await expect(page.locator('.export-feedback .feedback__text')).toHaveText('Download do PNG com ocultações solicitado ao navegador.')
    await expect(page.locator('.export-hint')).toHaveCount(0)
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await expect(page.locator('.export-feedback')).toHaveCount(0)
    await expect(page.locator('.export-hint')).toHaveText(REVIEW)
  })
}
