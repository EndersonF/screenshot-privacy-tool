import { expect, test } from '@playwright/test'
import type { Download, Page } from '@playwright/test'

const REVIEW = 'Antes de compartilhar, confira se ocultou todas as informações necessárias.'
const COPY = 'Imagem com ocultações copiada.'
const DOWNLOAD = 'Download do PNG com ocultações solicitado ao navegador.'

declare global {
  interface Window {
    __pendingPng: Array<(fail?: boolean) => void>
    __downloadRequests: number
    __clipboardRequests: number
    __settleClipboard?: (fail?: boolean) => void
    __copiedPng?: Blob
    __feedbackTimers?: number[]
    __clearedFeedbackTimers?: number[]
    __testRoot?: { unmount: () => void }
  }
}

async function loadImage(page: Page, width = 120, height = 90) {
  const png = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ee4444'
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height })
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  })
}

async function hideRegion(page: Page, start = 0.2, end = 0.6) {
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * start, bounds.y + bounds.height * start)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * end, bounds.y + bounds.height * end, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Ocultar região', exact: true }).click()
}

async function holdPng(page: Page) {
  await page.evaluate(() => {
    window.__pendingPng = []
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      toBlob.call(this, (blob) => {
        window.__pendingPng.push((fail = false) => callback(fail ? null : blob))
      }, type, quality)
    }
  })
}

async function releasePng(page: Page, fail = false) {
  await page.evaluate(async (fail) => {
    window.__pendingPng.shift()!(fail)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }, fail)
}

async function replaceImage(page: Page) {
  await loadImage(page, 80, 60)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Descartar e substituir' }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '80')
}

async function endEditing(page: Page) {
  await page.getByRole('button', { name: 'Nova imagem', exact: true }).click()
  await page.getByRole('button', { name: 'Descartar e voltar' }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await loadImage(page)
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
  await page.evaluate(() => {
    window.__downloadRequests = 0
    window.__clipboardRequests = 0
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__downloadRequests += 1
      click.call(this)
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        window.__clipboardRequests += 1
        window.__copiedPng = await items[0].getType('image/png')
      },
    } })
  })
})

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'))
  await page.evaluate(() => {
    window.__feedbackTimers = []
    window.__clearedFeedbackTimers = []
    const schedule = window.setTimeout.bind(window)
    const cancel = window.clearTimeout.bind(window)
    window.setTimeout = (handler, timeout, ...args) => {
      const timer = schedule(handler, timeout, ...args)
      if (timeout === 5000) window.__feedbackTimers!.push(timer)
      return timer
    }
    window.clearTimeout = (timer) => {
      if (timer !== undefined && window.__feedbackTimers!.includes(timer)) window.__clearedFeedbackTimers!.push(timer)
      cancel(timer)
    }
  })
}

async function copy(page: Page) {
  const timers = await page.evaluate(() => window.__feedbackTimers?.length)
  await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(COPY)
  // O texto pode ser idêntico ao da cópia anterior; aguardamos a nova conclusão.
  if (timers !== undefined) await expect.poll(() => page.evaluate(() => window.__feedbackTimers!.length)).toBe(timers + 1)
}

async function download(page: Page) {
  const timers = await page.evaluate(() => window.__feedbackTimers?.length)
  const requested = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  const png = await requested
  await expect(page.getByRole('status')).toHaveText(DOWNLOAD)
  if (timers !== undefined) await expect.poll(() => page.evaluate(() => window.__feedbackTimers!.length)).toBe(timers + 1)
  return png
}

async function readPng(page: Page, download: Download) {
  expect(await download.failure()).toBeNull()
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  const bytes = [...Buffer.concat(chunks)]
  expect(bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  return page.evaluate(async (bytes) => {
    const png = new Blob([Uint8Array.from(bytes)], { type: 'image/png' })
    const bitmap = await createImageBitmap(png)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data]
    return { width: canvas.width, height: canvas.height, first: pixel(40, 35), second: pixel(96, 72), outside: pixel(5, 5) }
  }, bytes)
}

test('cópia dura cinco segundos, restaura revisão sem anúncio nem mudança de foco', async ({ page }) => {
  await hideRegion(page)
  await freezeClock(page)
  await copy(page)
  const button = page.getByRole('button', { name: 'Copiar imagem protegida', exact: true })
  await expect(button).toBeFocused()
  await expect(page.locator('.export-feedback .feedback')).toHaveCount(1)
  await expect(page.locator('.export-hint')).toHaveCount(0)
  await page.clock.fastForward(4999)
  await expect(page.getByRole('status')).toHaveText(COPY)
  await page.clock.fastForward(1)
  await expect(page.locator('.export-feedback .feedback')).toHaveCount(0)
  await expect(page.locator('.export-hint')).toHaveText(REVIEW)
  await expect(button).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('[aria-live]')).toHaveCount(1)
  expect(await page.locator('.export-hint').evaluate((element) => element.closest('[aria-live], [role="status"]'))).toBeNull()
})

for (const openHelp of [false, true]) {
  test(`download expira sem desmontar ajuda ${openHelp ? 'aberta e focada' : 'recolhida'}`, async ({ page }) => {
    await hideRegion(page)
    await freezeClock(page)
    await download(page)
    const help = page.locator('.download-help')
    const summary = help.locator('summary')
    const original = await help.elementHandle()
    await summary.focus()
    if (openHelp) await page.keyboard.press('Enter')
    await page.clock.fastForward(5000)
    await expect(page.locator('.export-feedback .feedback')).toHaveCount(0)
    await expect(page.locator('.export-hint')).toHaveText(REVIEW)
    await expect(page.getByRole('status')).toHaveText('')
    await expect(help).toHaveCount(1)
    expect(await original!.evaluate((element) => element === document.querySelector('.download-help'))).toBe(true)
    await expect(help).toHaveJSProperty('open', openHelp)
    await expect(summary).toBeFocused()
    await expect(page.locator('[aria-live]')).toHaveCount(1)
    await page.keyboard.press('Space')
    await expect(help).toHaveJSProperty('open', !openHelp)
    await expect(page.getByRole('status')).toHaveText('')
    await copy(page)
    await expect(help).toHaveCount(0)
  })
}

test('nova notificação reinicia o prazo e timer anterior não apaga a mensagem recente', async ({ page }) => {
  await hideRegion(page)
  await freezeClock(page)
  await copy(page)
  await page.clock.fastForward(3000)
  await download(page)
  await page.clock.fastForward(2000)
  await expect(page.getByRole('status')).toHaveText(DOWNLOAD)
  await page.clock.fastForward(2999)
  await expect(page.getByRole('status')).toHaveText(DOWNLOAD)
  await page.clock.fastForward(1)
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('.download-help')).toHaveCount(1)
  await copy(page)
  await page.clock.fastForward(3000)
  await copy(page)
  await page.clock.fastForward(2000)
  await expect(page.getByRole('status')).toHaveText(COPY)
  await page.clock.fastForward(3000)
  await expect(page.getByRole('status')).toHaveText('')
})

for (const format of ['copy', 'download'] as const) {
  test(`erro de ${format} persiste após timer anterior e permite continuar editando`, async ({ page }) => {
    await hideRegion(page)
    await freezeClock(page)
    await copy(page)
    await page.clock.fastForward(2000)
    await page.evaluate((format) => {
      if (format === 'copy') navigator.clipboard.write = async () => { throw new Error('Falha controlada') }
      else HTMLCanvasElement.prototype.toBlob = (callback) => callback(null)
    }, format)
    await page.getByRole('button', { name: format === 'copy' ? 'Copiar imagem protegida' : 'Baixar PNG', exact: true }).click()
    const error = format === 'copy'
      ? 'Não foi possível copiar. Verifique a permissão da área de transferência ou use “Baixar PNG”.'
      : 'Não foi possível gerar o PNG desta imagem.'
    await expect(page.getByRole('status')).toHaveText(error)
    await page.clock.fastForward(15000)
    await expect(page.getByRole('status')).toHaveText(error)
    await expect(page.locator('.export-feedback .feedback--error')).toBeVisible()
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Última edição desfeita.')
    await expect(page.locator('.export-feedback .feedback')).toHaveCount(0)
    await page.clock.fastForward(10000)
    await expect(page.getByRole('status')).toHaveText('Última edição desfeita.')
  })
}

test('trocar imagem limpa timer, mensagem e ajuda sem apagar o status da nova edição', async ({ page }) => {
  await hideRegion(page)
  await freezeClock(page)
  await download(page)
  await page.clock.fastForward(2000)
  await replaceImage(page)
  await expect(page.locator('.download-help, .export-feedback .feedback')).toHaveCount(0)
  await page.clock.fastForward(10000)
  await expect(page.getByRole('status')).toHaveText('Arraste sobre a imagem para marcar o que deseja ocultar.')
  await hideRegion(page)
  await copy(page)
  await endEditing(page)
  await page.clock.fastForward(10000)
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('.download-help, .export-feedback')).toHaveCount(0)
})

test('expirar o feedback durante um arraste não desloca a imagem nem cancela a seleção', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.locator('canvas').evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await hideRegion(page)
  await freezeClock(page)
  await download(page)
  const canvas = page.locator('canvas')
  const before = (await canvas.boundingBox())!
  await page.mouse.move(before.x + before.width * 0.7, before.y + before.height * 0.7)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width * 0.9, before.y + before.height * 0.9)
  await expect(page.getByRole('button', { name: 'Ocultar região', exact: true })).toBeEnabled()
  await page.clock.fastForward(5000)
  await expect(page.locator('.export-hint')).toHaveText(REVIEW)
  expect(await canvas.boundingBox()).toEqual(before)
  await page.clock.runFor(32)
  await expect(page.getByRole('button', { name: 'Ocultar região', exact: true })).toBeEnabled()
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('status')).toHaveText('Seleção cancelada.')
})

test('sem tarjas mantém o aviso e, após o prazo, somente a ajuda permanece', async ({ page }) => {
  await freezeClock(page)
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const requested = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  const png = await readPng(page, await requested)
  expect(png.first).toEqual([238, 68, 68, 255])
  await expect(page.getByRole('status')).toHaveText('Download do PNG sem ocultações solicitado ao navegador.')
  await page.clock.fastForward(5000)
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('.export-hint, .export-feedback .feedback')).toHaveCount(0)
  await expect(page.locator('.download-help')).toBeVisible()
  await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
  await expect(page.locator('.download-help')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  await expect(page.getByRole('status')).toHaveText('Imagem copiada sem ocultações.')
  await page.clock.fastForward(5000)
  await expect(page.getByRole('status')).toHaveText('')
})

for (const finish of ['replace', 'end'] as const) {
  test(`PNG pendente não inicia download após ${finish}`, async ({ page }) => {
    await hideRegion(page)
    await holdPng(page)
    await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
    if (finish === 'replace') await replaceImage(page)
    else await endEditing(page)
    const status = await page.getByRole('status').textContent()
    await releasePng(page)
    expect(await page.evaluate(() => window.__downloadRequests)).toBe(0)
    await expect(page.getByRole('status')).toHaveText(status!)
    await expect(page.locator('.download-help, .export-feedback .feedback')).toHaveCount(0)
  })

  test(`cópia já solicitada não publica feedback após ${finish}`, async ({ page }) => {
    await hideRegion(page)
    await page.evaluate(() => {
      navigator.clipboard.write = async (items: ClipboardItem[]) => {
        window.__clipboardRequests += 1
        await items[0].getType('image/png')
        await new Promise<void>((resolve, reject) => {
          window.__settleClipboard = (fail = false) => fail ? reject(new Error('Falha controlada')) : resolve()
        })
      }
    })
    await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.__settleClipboard)).toBe(true)
    expect(await page.evaluate(() => window.__clipboardRequests)).toBe(1)
    if (finish === 'replace') await replaceImage(page)
    else await endEditing(page)
    const status = await page.getByRole('status').textContent()
    await page.evaluate(async () => {
      window.__settleClipboard!()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    expect(await page.evaluate(() => window.__clipboardRequests)).toBe(1)
    await expect(page.getByRole('status')).toHaveText(status!)
    await expect(page.locator('.export-feedback .feedback')).toHaveCount(0)
  })
}

for (const edit of ['add', 'remove', 'undo'] as const) {
  test(`download usa as tarjas do clique mesmo após ${edit} durante a geração`, async ({ page }) => {
    await hideRegion(page)
    await holdPng(page)
    await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
    if (edit === 'add') await hideRegion(page, 0.7, 0.9)
    else if (edit === 'undo') await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    else {
      const bounds = (await page.locator('canvas').boundingBox())!
      await page.mouse.click(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3)
      await page.getByRole('button', { name: 'Remover ocultação', exact: true }).click()
    }
    const requested = page.waitForEvent('download')
    await releasePng(page)
    const png = await readPng(page, await requested)
    expect(png).toEqual({
      width: 120, height: 90, first: [0, 0, 0, 255],
      second: [238, 68, 68, 255], outside: [238, 68, 68, 255],
    })
    await expect(page.getByRole('status')).toHaveText(DOWNLOAD)
    const current = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!
      return { first: [...context.getImageData(40, 35, 1, 1).data], second: [...context.getImageData(96, 72, 1, 1).data] }
    })
    expect(current.first).toEqual(edit === 'add' ? [0, 0, 0, 255] : [238, 68, 68, 255])
    expect(current.second).toEqual(edit === 'add' ? [0, 0, 0, 255] : [238, 68, 68, 255])
    if (edit === 'undo') {
      await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Refazer', exact: true })).toBeEnabled()
    } else await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeEnabled()
  })
}

test('cópia usa o PNG do clique após desfazer uma tarja durante a geração', async ({ page }) => {
  await hideRegion(page)
  await holdPng(page)
  await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
  expect(await page.evaluate(() => window.__clipboardRequests)).toBe(1)
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await releasePng(page)
  await expect(page.getByRole('status')).toHaveText(COPY)
  expect(await page.evaluate(async () => {
    const bitmap = await createImageBitmap(window.__copiedPng!)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    return { type: window.__copiedPng!.type, width: canvas.width, height: canvas.height, pixel: [...context.getImageData(40, 35, 1, 1).data] }
  })).toEqual({ type: 'image/png', width: 120, height: 90, pixel: [0, 0, 0, 255] })
  await expect(page.getByRole('button', { name: 'Refazer', exact: true })).toBeEnabled()
})

test('cancelar substituição mantém válida a exportação da imagem atual', async ({ page }) => {
  await hideRegion(page)
  await holdPng(page)
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
  await loadImage(page, 80, 60)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
  const requested = page.waitForEvent('download')
  await releasePng(page)
  const png = await readPng(page, await requested)
  expect(png.first).toEqual([0, 0, 0, 255])
  expect(await page.evaluate(() => window.__downloadRequests)).toBe(1)
  await expect(page.getByRole('status')).toHaveText(DOWNLOAD)
})

test('falha de geração de PNG da sessão anterior não altera a nova edição', async ({ page }) => {
  await hideRegion(page)
  await holdPng(page)
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
  await replaceImage(page)
  await releasePng(page, true)
  await expect(page.getByRole('status')).toHaveText('Arraste sobre a imagem para marcar o que deseja ocultar.')
  expect(await page.evaluate(() => window.__downloadRequests)).toBe(0)
})

test('falha tardia de clipboard não altera o estado vazio', async ({ page }) => {
  await hideRegion(page)
  await page.evaluate(() => {
    navigator.clipboard.write = async (items: ClipboardItem[]) => {
      await items[0].getType('image/png')
      await new Promise<void>((resolve, reject) => {
        window.__settleClipboard = (fail = false) => fail ? reject(new Error('Falha controlada')) : resolve()
      })
    }
  })
  await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
  await expect.poll(() => page.evaluate(() => !!window.__settleClipboard)).toBe(true)
  await endEditing(page)
  await page.evaluate(async () => {
    window.__settleClipboard!(true)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  await expect(page.getByRole('status')).toHaveText('')
  await expect(page.locator('.feedback')).toHaveCount(0)
})

test('desmontar limpa o timer e invalida download pendente', async ({ page }) => {
  await page.route('**/src/main.tsx', async (route) => {
    const response = await route.fetch()
    const body = (await response.text())
      .replace('ReactDOM.createRoot(', 'window.__testRoot = ReactDOM.createRoot(')
      .replace('.render(', '; window.__testRoot.render(')
    await route.fulfill({ response, body })
  })
  await page.reload()
  await loadImage(page)
  await expect(page.locator('canvas')).toBeVisible()
  await page.evaluate(() => {
    window.__downloadRequests = 0
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__downloadRequests += 1
      click.call(this)
    }
  })
  await hideRegion(page)
  await freezeClock(page)
  await download(page)
  await holdPng(page)
  await page.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__pendingPng.length)).toBe(1)
  await page.evaluate(() => window.__testRoot!.unmount())
  expect(await page.evaluate(() => window.__feedbackTimers!.every((timer) => window.__clearedFeedbackTimers!.includes(timer)))).toBe(true)
  await page.evaluate(() => window.__pendingPng.shift()!())
  await page.clock.fastForward(10000)
  expect(await page.evaluate(() => window.__downloadRequests)).toBe(1)
  await expect(page.locator('#root')).toBeEmpty()
})

for (const [width, height] of [[320, 568], [375, 667], [390, 844], [1440, 900]]) {
  test(`feedback, revisão e ajuda mantêm layout acessível em ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.locator('canvas').evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    })
    await hideRegion(page)
    await freezeClock(page)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    const initialButtons = await page.locator('.topbar button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().y))
    const check = async (state: string) => {
      await expect(page.getByRole('status')).toHaveCount(1)
      await expect(page.locator('[aria-live]')).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const header = (await page.locator('.topbar').boundingBox())!
      for (const button of await page.locator('.topbar button').all()) {
        const bounds = (await button.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(header.height)
        expect(await button.evaluate((button) => {
          const bounds = button.getBoundingClientRect()
          return document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('button') === button
        })).toBe(true)
      }
      if (width > 1100) expect(await page.locator('.topbar button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().y))).toEqual(initialButtons)
      const viewport = (await page.locator('.image-viewport').boundingBox())!
      expect(viewport.y).toBeGreaterThanOrEqual(header.height)
      expect(viewport.height).toBeGreaterThan(0)
      const text = page.locator('.export-feedback .feedback__text, .export-hint, .download-help summary, .download-help[open] p')
      for (const element of await text.all()) {
        const bounds = (await element.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(header.height)
      }
      await page.screenshot({ path: testInfo.outputPath(`${width}-${state}.png`), animations: 'disabled', fullPage: true })
    }
    await check('ready')
    const originalCanvas = await page.locator('canvas').boundingBox()
    await copy(page)
    await check('copy')
    await page.clock.fastForward(5000)
    await check('copy-expired')
    expect(await page.locator('canvas').boundingBox()).toEqual(originalCanvas)
    await download(page)
    await check('download')
    await page.clock.fastForward(5000)
    await expect(page.locator('.export-hint')).toHaveText(REVIEW)
    await check('download-expired')
    await page.locator('.download-help summary').click()
    await check('help-expanded')
    await download(page)
    const withFeedback = (await page.locator('canvas').boundingBox())!
    await page.clock.fastForward(5000)
    await expect(page.locator('.download-help')).toHaveJSProperty('open', true)
    await check('help-expanded-expired')
    expect(Math.abs((await page.locator('canvas').boundingBox())!.y - withFeedback.y)).toBeLessThanOrEqual(20)
    await page.evaluate(() => { navigator.clipboard.write = async () => { throw new Error('Falha controlada') } })
    await page.getByRole('button', { name: 'Copiar imagem protegida', exact: true }).click()
    await page.clock.fastForward(10000)
    await expect(page.locator('.export-feedback .feedback--error')).toBeVisible()
    await check('persistent-error')
    expect(errors).toEqual([])
  })
}
