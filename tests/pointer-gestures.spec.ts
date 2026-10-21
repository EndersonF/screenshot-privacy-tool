import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type ObservedPointer = { type: string; id: number; pointerType: string }

declare global {
  interface Window {
    __gesturePointers: ObservedPointer[]
    __gesturePng: Blob | null
  }
}

// Emulação Chromium: não substitui Safari/iPhone ou Chrome/Android físicos.
test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ee4444'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })
  await expect(page.locator('canvas')).toBeVisible()
  // As coordenadas CDP precisam da geometria final da animação de entrada.
  await page.locator('canvas').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
  await page.evaluate(() => {
    window.__gesturePointers = []
    window.__gesturePng = null
    const original = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob) window.__gesturePng = blob
      return original(blob)
    }
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      window.addEventListener(type, (event) => {
        const pointer = event as PointerEvent
        window.__gesturePointers.push({ type, id: pointer.pointerId, pointerType: pointer.pointerType })
      }, true)
    }
  })
})

async function touchInput(page: Page) {
  const session = await page.context().newCDPSession(page)
  const bounds = (await page.locator('canvas').boundingBox())!
  const contacts = new Map<number, { id: number; x: number; y: number }>()
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel') =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: [...contacts.values()] })
  const position = (id: number, x: number, y: number) => ({
    id, x: Math.round(bounds.x + bounds.width * x), y: Math.round(bounds.y + bounds.height * y),
  })
  return {
    async start(id: number, x: number, y: number) {
      contacts.set(id, position(id, x, y))
      await send('touchStart')
    },
    async move(id: number, x: number, y: number) {
      contacts.set(id, position(id, x, y))
      await send('touchMove')
    },
    async end(id: number) {
      const contact = contacts.get(id)!
      contacts.delete(id)
      // No Chromium, touchEnd identifica o contato retirado; omiti-lo num
      // touchMove não o encerra. O teste confere os pointerup efetivos.
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd', touchPoints: contacts.size ? [contact] : [],
      })
    },
    async cancel() {
      contacts.clear()
      await send('touchCancel')
    },
  }
}

async function pixel(page: Page, x: number, y: number) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement, point) =>
    [...canvas.getContext('2d')!.getImageData(point.x, point.y, 1, 1).data], { x, y })
}

async function exportedPixels(page: Page) {
  // Compara todos os pixels do PNG real, sem substituir sua composição.
  await page.evaluate(() => { window.__gesturePng = null })
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  await expect.poll(() => page.evaluate(() => window.__gesturePng?.size ?? 0)).toBeGreaterThan(0)
  return page.evaluate(async () => {
    const image = await createImageBitmap(window.__gesturePng!)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    image.close()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const digest = await crypto.subtle.digest('SHA-256', pixels)
    return { width: canvas.width, height: canvas.height, digest: [...new Uint8Array(digest)] }
  })
}

for (const pointerType of ['mouse', 'pen'] as const) {
  test(`seleção com ${pointerType} mantém a confirmação após a liberação normal da captura`, async ({ page }) => {
    const session = await page.context().newCDPSession(page)
    const bounds = (await page.locator('canvas').boundingBox())!
    const start = { x: bounds.x + bounds.width * 0.1, y: bounds.y + bounds.height * 0.1 }
    const end = { x: bounds.x + bounds.width * 0.3, y: bounds.y + bounds.height * 0.3 }
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, pointerType, button: 'left', buttons: 1 })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...end, pointerType, buttons: 1 })
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, pointerType, button: 'left', buttons: 0 })
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
    await expect(page.getByRole('status')).toContainText('Região marcada.')
    await page.getByRole('button', { name: 'Ocultar região' }).click()
    expect(await pixel(page, 32, 24)).toEqual([0, 0, 0, 255])
  })
}

test('um dedo seleciona normalmente e mantém pointer capture durante o arraste', async ({ page }) => {
  const touch = await touchInput(page)
  await touch.start(1, 0.1, 0.1)
  await touch.move(1, 0.3, 0.3)
  expect(await page.locator('canvas').evaluate((canvas) => {
    const pointer = window.__gesturePointers.find((event) => event.type === 'pointerdown' && event.pointerType === 'touch')!
    return canvas.hasPointerCapture(pointer.id)
  })).toBe(true)
  await touch.end(1)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  expect(await pixel(page, 32, 24)).toEqual([0, 0, 0, 255])
})

for (const firstToLift of [1, 2]) {
  test(`multitoque cancela e bloqueia até todos saírem, retirando primeiro o dedo ${firstToLift}`, async ({ page }) => {
    const touch = await touchInput(page)
    await touch.start(1, 0.1, 0.1)
    await touch.move(1, 0.3, 0.3)
    await touch.end(1)
    await page.getByRole('button', { name: 'Ocultar região' }).click()
    await touch.start(1, 0.5, 0.5)
    await touch.move(1, 0.7, 0.7)
    await touch.end(1)
    await page.getByRole('button', { name: 'Ocultar região' }).click()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    const before = await exportedPixels(page)
    await page.evaluate(() => { window.__gesturePointers = [] })

    await touch.start(1, 0.4, 0.4)
    await touch.move(1, 0.5, 0.5)
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
    await touch.start(2, 0.8, 0.8)
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
    await touch.move(1, 0.3, 0.3)
    await touch.move(2, 0.9, 0.9)
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
    await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
    const ids = await page.evaluate(() => window.__gesturePointers.filter((event) => event.type === 'pointerdown' && event.pointerType === 'touch').map((event) => event.id))
    await touch.end(firstToLift)
    await expect.poll(() => page.evaluate(() => window.__gesturePointers.filter((event) => event.type === 'pointerup' && event.pointerType === 'touch').map((event) => event.id))).toEqual([ids[firstToLift - 1]])
    const remaining = firstToLift === 1 ? 2 : 1
    await touch.move(remaining, 0.6, 0.6)
    await touch.start(3, 0.9, 0.2)
    await touch.move(3, 0.8, 0.2)
    await touch.end(3)
    await touch.move(remaining, 0.4, 0.8)
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
    await touch.end(remaining)
    await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Refazer' })).toBeEnabled()
    expect(await exportedPixels(page)).toEqual(before)
    expect(before).toMatchObject({ width: 160, height: 120 })
    expect(await pixel(page, 32, 24)).toEqual([0, 0, 0, 255])
    expect(await pixel(page, 96, 72)).toEqual([238, 68, 68, 255])
    await page.getByRole('button', { name: 'Refazer' }).click()
    expect(await pixel(page, 96, 72)).toEqual([0, 0, 0, 255])
    await page.getByRole('button', { name: 'Desfazer' }).click()
    expect(await pixel(page, 96, 72)).toEqual([238, 68, 68, 255])

    await touch.start(4, 0.4, 0.4)
    await touch.move(4, 0.6, 0.6)
    await touch.end(4)
    await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
  })
}

test('pointercancel limpa a seleção e substitui a mensagem antiga, permitindo um novo gesto', async ({ page }) => {
  const touch = await touchInput(page)
  await touch.start(1, 0.1, 0.1)
  await touch.move(1, 0.3, 0.3)
  await touch.end(1)
  await expect(page.getByRole('status')).toContainText('Região marcada.')
  await touch.start(1, 0.5, 0.5)
  await touch.move(1, 0.8, 0.8)
  await touch.cancel()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
  await touch.start(2, 0.4, 0.4)
  await touch.move(2, 0.7, 0.7)
  await touch.end(2)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
})

test('pointercancel encerra também um gesto multitoque sem deixar o editor bloqueado', async ({ page }) => {
  const touch = await touchInput(page)
  await touch.start(1, 0.1, 0.1)
  await touch.move(1, 0.3, 0.3)
  await touch.start(2, 0.7, 0.7)
  await touch.cancel()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
  await touch.start(3, 0.4, 0.4)
  await touch.move(3, 0.7, 0.7)
  await touch.end(3)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
})

test('um segundo dedo fora do canvas também cancela e mantém o bloqueio até sair', async ({ page }) => {
  const touch = await touchInput(page)
  await touch.start(1, 0.1, 0.1)
  await touch.move(1, 0.3, 0.3)
  await touch.start(2, 0.8, -0.3)
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
  await touch.end(1)
  await touch.start(3, 0.5, 0.5)
  await touch.move(3, 0.7, 0.7)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await touch.end(3)
  await touch.end(2)
  await touch.start(4, 0.4, 0.4)
  await touch.move(4, 0.7, 0.7)
  await touch.end(4)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
})

test('perda inesperada da captura cancela o arraste e a retirada fora do canvas não prende o bloqueio', async ({ page }) => {
  const touch = await touchInput(page)
  await touch.start(1, 0.1, 0.1)
  await touch.move(1, 0.3, 0.3)
  await page.locator('canvas').evaluate((canvas) => {
    const pointer = window.__gesturePointers.find((event) => event.type === 'pointerdown' && event.pointerType === 'touch')!
    canvas.releasePointerCapture(pointer.id)
  })
  await touch.move(1, 0.4, -0.3)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
  await touch.start(2, 0.7, 0.7)
  await touch.end(1)
  await touch.move(2, 0.6, 0.6)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeDisabled()
  await touch.end(2)
  await touch.start(3, 0.4, 0.4)
  await touch.move(3, 0.7, 0.7)
  await touch.end(3)
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
})

test('eventos de outro ponteiro não alteram nem encerram o arraste do mouse', async ({ page }) => {
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.1)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3)
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
    await page.locator('canvas').dispatchEvent(type, {
      pointerId: 999, pointerType: 'pen', button: 0,
      clientX: bounds.x + bounds.width * 0.8, clientY: bounds.y + bounds.height * 0.8,
    })
  }
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Ocultar região' })).toBeEnabled()
  await page.getByRole('button', { name: 'Ocultar região' }).click()
  expect(await pixel(page, 32, 24)).toEqual([0, 0, 0, 255])
  expect(await pixel(page, 128, 96)).toEqual([238, 68, 68, 255])
})
