import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const DOWNLOAD_HELP = 'Confira a pasta de downloads definida pelo navegador. No iPhone, procure na lista de downloads do Safari ou no app Arquivos. O PNG não aparece automaticamente no Fotos.'

type DownloadLifecycle = {
  created: Array<{ url: string; type: string | null; size: number | null }>
  revoked: string[]
}

declare global {
  interface Window {
    __downloadLifecycle: DownloadLifecycle
    __downloadFault?: 'generate' | 'url' | 'click'
  }
}

async function syntheticImage(page: Page, width = 120, height = 90, color = '#ee4444') {
  const png = await page.evaluate(({ width, height, color }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png').split(',')[1]
  }, { width, height, color })
  return { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }
}

async function applyRedaction(page: Page) {
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.6, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Ocultar região' }).click()
}

async function lifecycle(page: Page) {
  return page.evaluate(() => window.__downloadLifecycle)
}

async function downloadPng(page: Page, withoutRedactions = false) {
  const requested = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  if (withoutRedactions) {
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar mesmo assim' }).click()
  }
  const download = await requested
  expect(download.suggestedFilename()).toBe('screenshot-protegido.png')
  // A conclusão do download gerenciado pelo Playwright não comprova salvamento no iPhone.
  expect(await download.failure()).toBeNull()
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const bytes = Buffer.concat(chunks)
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  return page.evaluate(async (data) => {
    const png = new Blob([Uint8Array.from(data)], { type: 'image/png' })
    const bitmap = await createImageBitmap(png)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    return {
      width: canvas.width,
      height: canvas.height,
      outside: [...context.getImageData(5, 5, 1, 1).data],
      covered: [...context.getImageData(40, 35, 1, 1).data],
      allOriginal: pixels.every((value, index) => value === [238, 68, 68, 255][index % 4]),
      digest: [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))],
    }
  }, [...bytes])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(await syntheticImage(page))
  await expect(page.locator('canvas')).toHaveAttribute('width', '120')
  await page.evaluate(() => {
    // Observa URLs e metadados, sem reter Blobs que falseariam a limpeza sob teste.
    const state: DownloadLifecycle = { created: [], revoked: [] }
    window.__downloadLifecycle = state
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    const click = HTMLAnchorElement.prototype.click
    const toBlob = HTMLCanvasElement.prototype.toBlob
    URL.createObjectURL = (value) => {
      if (window.__downloadFault === 'url') throw new Error('Falha simulada ao criar URL')
      const url = create(value)
      state.created.push({
        url,
        type: value instanceof Blob ? value.type : null,
        size: value instanceof Blob ? value.size : null,
      })
      return url
    }
    URL.revokeObjectURL = (url) => {
      state.revoked.push(url)
      revoke(url)
    }
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        if (window.__downloadFault === 'click') throw new Error('Falha simulada ao acionar download')
      }
      click.call(this)
    }
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (window.__downloadFault === 'generate') {
        callback(null)
        return
      }
      toBlob.call(this, callback, type, quality)
    }
  })
})

test('downloads com tarjas preservam PNG, dimensões e pixels e revogam as URLs após um segundo', async ({ page }) => {
  await applyRedaction(page)
  await expect(page.locator('details.download-help')).toHaveCount(0)
  await page.clock.install()
  const first = await downloadPng(page)
  expect(first.width).toBe(120)
  expect(first.height).toBe(90)
  expect(first.covered).toEqual([0, 0, 0, 255])
  expect(first.outside).toEqual([238, 68, 68, 255])
  expect(first.allOriginal).toBe(false)
  await expect(page.getByRole('status')).toHaveText('Download do PNG com ocultações solicitado ao navegador.')
  await expect(page.locator('details.download-help summary')).toHaveText('Não encontrou o arquivo?')
  await expect(page.locator('details.download-help')).toHaveJSProperty('open', false)
  const firstState = await lifecycle(page)
  expect(firstState.created).toHaveLength(1)
  expect(firstState.created[0].type).toBe('image/png')
  expect(firstState.created[0].size).toBeGreaterThan(0)
  expect(firstState.revoked).toEqual([])

  await page.clock.fastForward(1000)
  expect((await lifecycle(page)).revoked).toEqual([firstState.created[0].url])

  for (let index = 0; index < 3; index += 1) {
    const next = await downloadPng(page)
    expect(next.digest).toEqual(first.digest)
    const state = await lifecycle(page)
    expect(state.created).toHaveLength(index + 2)
    expect(state.revoked).toEqual(state.created.slice(0, -1).map(({ url }) => url))
    expect(state.created.every(({ type }) => type === 'image/png')).toBe(true)
    await expect(page.locator('a[download]')).toHaveCount(0)
    await page.clock.fastForward(1000)
    expect((await lifecycle(page)).revoked).toEqual(state.created.map(({ url }) => url))
  }

  // Desfazer comprova que a imagem original continua intacta após as exportações.
  await page.getByRole('button', { name: 'Desfazer' }).click()
  const originalPixel = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
    [...canvas.getContext('2d')!.getImageData(40, 35, 1, 1).data])
  expect(originalPixel).toEqual([238, 68, 68, 255])
  await expect(page.getByRole('button', { name: 'Refazer' })).toBeEnabled()
  await expect(page.locator('details.download-help')).toHaveCount(0)
})

test('download sem tarjas mantém revisão, pixels originais e feedback preciso', async ({ page }) => {
  await expect(page.locator('details.download-help')).toHaveCount(0)
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar à edição' }).click()
  await expect(page.locator('details.download-help')).toHaveCount(0)
  expect((await lifecycle(page)).created).toEqual([])
  const png = await downloadPng(page, true)
  expect({ width: png.width, height: png.height }).toEqual({ width: 120, height: 90 })
  expect(png.allOriginal).toBe(true)
  expect((await lifecycle(page)).created[0].type).toBe('image/png')
  await expect(page.getByRole('status')).toHaveText('Download do PNG sem ocultações solicitado ao navegador.')
  await expect(page.locator('details.download-help summary')).toHaveText('Não encontrou o arquivo?')
  await expect(page.locator('details.download-help')).toHaveJSProperty('open', false)
})

for (const fault of ['generate', 'url', 'click'] as const) {
  test(`falha de ${fault} distingue a etapa e limpa os recursos criados`, async ({ page }) => {
    await applyRedaction(page)
    await page.clock.install()
    const downloads: string[] = []
    page.on('download', (download) => downloads.push(download.suggestedFilename()))
    await page.evaluate((value) => { window.__downloadFault = value }, fault)

    await page.getByRole('button', { name: 'Baixar PNG' }).click()
    await expect(page.getByRole('status')).toHaveText(fault === 'generate'
      ? 'Não foi possível gerar o PNG desta imagem.'
      : 'Não foi possível solicitar o download. Tente novamente.')
    const state = await lifecycle(page)
    expect(state.created).toHaveLength(fault === 'click' ? 1 : 0)
    expect(state.revoked).toEqual([])
    expect(downloads).toEqual([])
    await expect(page.locator('details.download-help')).toHaveCount(0)
    await expect(page.locator('a[download]')).toHaveCount(0)
    await page.clock.fastForward(1000)
    expect((await lifecycle(page)).revoked).toEqual(state.created.map(({ url }) => url))
  })
}

test('ajuda de download abre e fecha pelo teclado fora da região de anúncio', async ({ page }) => {
  await applyRedaction(page)
  await downloadPng(page)
  const help = page.locator('details.download-help')
  const summary = help.locator('summary')
  const explanation = help.locator('p')
  await expect(help).toHaveJSProperty('open', false)
  await expect(explanation).toBeHidden()

  // Chega à ajuda por Tab, passando pelos controles de visualização e pela imagem.
  await page.getByRole('button', { name: 'Copiar imagem protegida' }).focus()
  for (const control of [
    page.getByRole('button', { name: 'Ampliar', exact: true }),
    page.getByRole('button', { name: 'Imagem inteira', exact: true }),
    page.getByRole('button', { name: 'Mover imagem', exact: true }),
    page.getByRole('region', { name: 'Visualização da imagem', exact: true }),
    summary,
  ]) {
    await page.keyboard.press('Tab')
    await expect(control).toBeFocused()
  }
  await page.keyboard.press('Enter')
  await expect(help).toHaveJSProperty('open', true)
  await expect(explanation).toBeVisible()
  await expect(explanation).toHaveText(DOWNLOAD_HELP)
  expect(await summary.evaluate((element) => element.matches(':focus-visible'))).toBe(true)

  await expect(page.getByRole('status')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveText('Download do PNG com ocultações solicitado ao navegador.')
  await expect(page.getByRole('status')).not.toContainText('Não encontrou o arquivo?')
  await expect(page.getByRole('status')).not.toContainText(DOWNLOAD_HELP)
  expect(await help.evaluate((element) =>
    element.closest('[aria-hidden="true"], [role="status"], [aria-live]:not([aria-live="off"])') === null)).toBe(true)
  expect(await explanation.evaluate((element) =>
    element.closest('[aria-hidden="true"], [role="status"], [aria-live]:not([aria-live="off"])') === null)).toBe(true)
  await expect(page.locator('.statusbar__feedback > .feedback[aria-hidden="true"]')).toHaveCount(1)
  await expect(page.locator('.statusbar__feedback > details.download-help')).toHaveCount(1)

  await page.keyboard.press('Space')
  await expect(help).toHaveJSProperty('open', false)
  await expect(explanation).toBeHidden()
  await expect(summary).toBeFocused()
})

test('carregar outra imagem limpa a ajuda específica do download anterior', async ({ page }) => {
  await downloadPng(page, true)
  await page.locator('details.download-help summary').click()
  await expect(page.locator('details.download-help p')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(await syntheticImage(page, 80, 60, '#00aa66'))
  await expect(page.locator('canvas')).toHaveAttribute('width', '80')
  await expect(page.locator('details.download-help')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Arraste sobre a imagem para marcar o que deseja ocultar.')
})

for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`feedback e ajuda ficam perceptíveis na tela de ${width}x${height}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await applyRedaction(page)
    await downloadPng(page)
    const help = page.locator('details.download-help')
    const summary = help.locator('summary')
    const feedback = page.locator('.statusbar__feedback .feedback__text')

    // Sem rolar ou mover o foco: o retorno da ação já deve estar perceptível.
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await expect(feedback).toHaveCSS('opacity', '1')

    for (const open of [false, true]) {
      if (open) await summary.click()
      await expect(help).toHaveJSProperty('open', open)
      if (open) await expect(help.locator('p')).toBeVisible()
      else await expect(help.locator('p')).toBeHidden()
      const toolbar = (await page.locator('.topbar').boundingBox())!
      for (const element of [feedback, summary]) {
        const bounds = (await element.boundingBox())!
        expect(bounds.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1)
      }
      for (const name of ['Baixar PNG', 'Copiar imagem protegida']) {
        const button = page.getByRole('button', { name })
        await expect(button).toBeEnabled()
        await expect(button).toBeVisible()
        await expect(button).toBeInViewport()
        const bounds = (await button.boundingBox())!
        expect(bounds.y).toBeGreaterThanOrEqual(0)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(toolbar.y + toolbar.height + 1)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      for (const selector of ['.statusbar', '.statusbar__feedback', '.statusbar__meta', 'details.download-help', 'details.download-help summary', ...(open ? ['details.download-help p'] : [])]) {
        const bounds = await page.locator(selector).boundingBox()
        expect(bounds, selector).not.toBeNull()
        expect(bounds!.x, selector).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width, selector).toBeLessThanOrEqual(width + 1)
      }
      await page.screenshot({
        path: testInfo.outputPath(`download-help-${width}-${open ? 'expanded' : 'closed'}.png`),
        fullPage: true,
      })
    }
  })
}
