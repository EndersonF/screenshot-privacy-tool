// Reproduzir: npm run build; npx vite preview --host 127.0.0.1 --port 5184 --strictPort
// Depois: node scripts/performance.mjs (--only=800x600:simple limita o cenário).
// Imagens e métricas são geradas localmente; somente o relatório JSON é salvo.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { freemem } from 'node:os'
import { performance } from 'node:perf_hooks'

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const baseURL = option('url') ?? 'http://127.0.0.1:5184/'
const channels = (option('browsers') ?? 'chrome,msedge').split(',')
const only = option('only')
const outputPath = `performance-results/${option('output') ?? 'performance.json'}`
const repeats = Number(option('repeats') ?? 2)
const MiB = 1024 * 1024
const dimensions = [[800, 600], [1920, 1080], [2560, 1440], [3840, 2160], [1440, 6000], [6000, 8000]]
const kinds = ['simple', 'interface', 'complex']
const regions = [
  [0.05, 0.10, 0.15, 0.18],
  [0.25, 0.25, 0.35, 0.33],
  [0.45, 0.40, 0.55, 0.48],
  [0.65, 0.55, 0.75, 0.63],
  [0.80, 0.75, 0.90, 0.83],
]
const samples = regions.map(([x1, y1, x2, y2]) => [(x1 + x2) / 2, (y1 + y2) / 2])
samples.push([0.95, 0.05])
const scenarios = dimensions.flatMap(([width, height]) => kinds.map((kind) => ({
  width, height, kind, key: `${width}x${height}:${kind}`,
}))).filter(({ key }) => !only || key === only)
const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  repeats,
  hostFreeMiBAtStart: Math.round(freemem() / MiB),
  note: 'Process working set/private bytes sum browser-family processes; shared pages may be counted more than once.',
  results: [],
}

function round(value) { return Math.round(value * 10) / 10 }
function toMiB(bytes) { return round(bytes / MiB) }
async function saveReport() {
  await mkdir('performance-results', { recursive: true })
  await writeFile(outputPath, JSON.stringify(report, null, 2))
}

async function generateFixture(page, { width, height, kind }) {
  const dataURL = await page.evaluate(async ({ width, height, kind }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas de geração indisponível')

    if (kind === 'simple') {
      context.fillStyle = '#f4f6f8'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#16324f'
      context.font = 'bold 32px Arial'
      context.fillText('Screenshot sintético', 40, 70)
      context.font = '20px Arial'
      for (let y = 140; y < height; y += 240) context.fillText(`Linha de teste ${y}`, 40, y)
    } else if (kind === 'interface') {
      context.fillStyle = '#edf2f7'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#183153'
      context.fillRect(0, 0, width, 72)
      context.fillStyle = '#ffffff'
      context.font = 'bold 25px Arial'
      context.fillText('Painel fictício', 32, 45)
      context.font = '16px Arial'
      for (let y = 110, row = 0; y < height; y += 58, row += 1) {
        context.fillStyle = row % 2 ? '#ffffff' : '#dce7f1'
        context.fillRect(24, y, width - 48, 48)
        context.fillStyle = '#28445f'
        context.fillText(`Campo ${row + 1}`, 42, y + 31)
        for (let col = 1; col <= 3; col += 1) {
          context.fillStyle = '#9fb4c7'
          context.fillRect(42 + col * (width - 100) / 4, y + 13, Math.max(16, (width - 160) / 7), 18)
        }
      }
    } else {
      const tile = document.createElement('canvas')
      tile.width = tile.height = 256
      const tileContext = tile.getContext('2d')
      const pixels = tileContext.createImageData(256, 256)
      let seed = 0x12345678
      for (let index = 0; index < pixels.data.length; index += 4) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
        pixels.data[index] = seed & 255
        pixels.data[index + 1] = (seed >>> 8) & 255
        pixels.data[index + 2] = (seed >>> 16) & 255
        pixels.data[index + 3] = 255
      }
      tileContext.putImageData(pixels, 0, 0)
      context.fillStyle = context.createPattern(tile, 'repeat')
      context.fillRect(0, 0, width, height)
      context.strokeStyle = '#ffffff'
      context.lineWidth = 2
      for (let y = 30; y < height; y += 181) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y + 43); context.stroke()
      }
    }
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG sintético indisponível')), 'image/png'))
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }, { width, height, kind })
  return Buffer.from(dataURL.split(',')[1], 'base64')
}

async function processMemory(browserSession) {
  try {
    const { processInfo } = await browserSession.send('SystemInfo.getProcessInfo')
    const ids = processInfo.map(({ id }) => id).filter(Number.isInteger)
    if (!ids.length) return null
    const command = `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', timeout: 5000 }).trim()
    const processes = [].concat(JSON.parse(output))
    return {
      processCount: processes.length,
      workingSetMiB: toMiB(processes.reduce((sum, item) => sum + item.WorkingSet64, 0)),
      privateMiB: toMiB(processes.reduce((sum, item) => sum + item.PrivateMemorySize64, 0)),
    }
  } catch { return null }
}

async function memorySnapshot(pageSession, browserSession) {
  const { metrics } = await pageSession.send('Performance.getMetrics')
  const heap = metrics.find(({ name }) => name === 'JSHeapUsedSize')?.value
  return { jsHeapMiB: heap === undefined ? null : toMiB(heap), processes: await processMemory(browserSession) }
}

async function canvasSamples(page) {
  return page.locator('canvas').evaluate((canvas, points) => {
    const context = canvas.getContext('2d')
    return points.map(([x, y]) => [...context.getImageData(
      Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1,
    ).data])
  }, samples)
}

async function dragRegion(page, [x1, y1, x2, y2]) {
  const bounds = await page.locator('canvas').boundingBox()
  if (!bounds) throw new Error('Canvas não encontrado')
  await page.mouse.move(bounds.x + bounds.width * x1, bounds.y + bounds.height * y1)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * x2, bounds.y + bounds.height * y2, { steps: 2 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Ocultar região' }).click()
}

async function exportedSamples(page) {
  return page.evaluate(async (points) => {
    const blob = window.__perfBlob
    if (!blob) throw new Error('Blob exportado não capturado')
    const bitmap = await createImageBitmap(blob)
    const pixel = document.createElement('canvas')
    pixel.width = pixel.height = 1
    const context = pixel.getContext('2d')
    const colors = points.map(([x, y]) => {
      const px = Math.floor(x * bitmap.width)
      const py = Math.floor(y * bitmap.height)
      context.clearRect(0, 0, 1, 1)
      context.drawImage(bitmap, -px, -py)
      return [...context.getImageData(0, 0, 1, 1).data]
    })
    const result = { width: bitmap.width, height: bitmap.height, colors }
    bitmap.close()
    window.__perfBlob = null
    return result
  }, samples)
}

async function cycle(page, pageSession, browserSession, scenario, fixture) {
  const { width, height } = scenario
  await pageSession.send('HeapProfiler.collectGarbage')
  const before = await memorySnapshot(pageSession, browserSession)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher arquivo' }).click()
  const startedLoad = performance.now()
  await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: fixture })
  await page.waitForFunction(([w, h]) => {
    const canvas = document.querySelector('canvas')
    return canvas?.width === w && canvas.height === h
  }, [width, height])
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const loadMs = round(performance.now() - startedLoad)
  const loaded = await memorySnapshot(pageSession, browserSession)
  const original = await canvasSamples(page)

  const startedApply = performance.now()
  for (const region of regions) await dragRegion(page, region)
  const applyFiveMs = round(performance.now() - startedApply)
  const redacted = await canvasSamples(page)
  if (redacted.slice(0, 5).some((pixel) => pixel.join(',') !== '0,0,0,255')) throw new Error('Tarja ausente no preview')
  await page.getByRole('button', { name: 'Desfazer' }).click()
  const undone = await canvasSamples(page)
  if (undone[4].join(',') !== original[4].join(',')) throw new Error('Desfazer não restaurou o pixel')
  await page.getByRole('button', { name: 'Refazer' }).click()
  const edited = await memorySnapshot(pageSession, browserSession)

  await page.evaluate(() => {
    window.__perfBlob = null
    window.__perfCreateObjectURL ??= URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => { window.__perfBlob = blob; return window.__perfCreateObjectURL(blob) }
  })
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 })
  const startedExport = performance.now()
  await page.getByRole('button', { name: 'Baixar PNG' }).click()
  const download = await downloadPromise
  await download.path()
  const exportMs = round(performance.now() - startedExport)
  const exported = await exportedSamples(page)
  if (exported.width !== width || exported.height !== height) throw new Error('Dimensões exportadas divergentes')
  if (exported.colors.slice(0, 5).some((pixel) => pixel.join(',') !== '0,0,0,255')) throw new Error('Tarja ausente no PNG')
  if (exported.colors[5].join(',') !== original[5].join(',')) throw new Error('Pixel externo alterado no PNG')
  const afterExport = await memorySnapshot(pageSession, browserSession)

  await page.getByRole('button', { name: 'Nova imagem' }).click()
  await page.getByRole('button', { name: 'Descartar e voltar' }).click()
  await page.getByRole('button', { name: 'Escolher arquivo' }).waitFor()
  await pageSession.send('HeapProfiler.collectGarbage')
  const afterClear = await memorySnapshot(pageSession, browserSession)
  return { loadMs, applyFiveMs, exportMs, before, loaded, edited, afterExport, afterClear }
}

async function runBrowser(channel) {
  for (const scenario of scenarios) {
    let browser
    try { browser = await chromium.launch({ channel, headless: true }) }
    catch (error) {
      report.results.push({ browser: channel, ...scenario, status: 'browser-unavailable', error: String(error) })
      await saveReport()
      continue
    }
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('crash', () => pageErrors.push('A aba travou'))
      await page.goto(baseURL)
      const pageSession = await context.newCDPSession(page)
      const browserSession = await browser.newBrowserCDPSession()
      await pageSession.send('Performance.enable')

      const freeMiB = Math.round(freemem() / MiB)
      // Folga operacional do benchmark: seis buffers RGBA e 256 MiB livres.
      // Não representa um limite de imagem do produto.
      const safetyNeedMiB = Math.ceil(scenario.width * scenario.height * 4 * 6 / MiB + 256)
      const result = { browser: channel, ...scenario, freeMiBBefore: freeMiB, safetyNeedMiB, fileKiB: null, status: 'ok', cycles: [], errors: [] }
      if (freeMiB < safetyNeedMiB) {
        result.status = 'skipped-low-memory'
        report.results.push(result)
        console.log(`${channel} ${scenario.key}: skipped (${freeMiB} MiB free; ${safetyNeedMiB} MiB safety requirement)`)
        await saveReport()
        continue
      }
      try {
        const fixture = await generateFixture(page, scenario)
        result.fileKiB = round(fixture.length / 1024)
        await page.reload()
        for (let repetition = 0; repetition < repeats; repetition += 1) {
          const errorsBefore = pageErrors.length
          const watchdog = setTimeout(() => { void context.close() }, 120000)
          try {
            result.cycles.push(await cycle(page, pageSession, browserSession, scenario, fixture))
            result.errors.push(...pageErrors.slice(errorsBefore))
          } finally { clearTimeout(watchdog) }
        }
        if (result.errors.length) result.status = 'browser-error'
      } catch (error) {
        result.status = 'failed'
        result.errors.push(String(error), ...pageErrors)
      }
      report.results.push(result)
      console.log(`${channel} ${scenario.key}: ${result.status}, ${result.fileKiB ?? 'n/a'} KiB, ${result.cycles.length}/${repeats} cycles`)
      await saveReport()
      await context.close()
    } finally { await browser.close() }
  }
}

for (const channel of channels) await runBrowser(channel)
await saveReport()
console.log(`Report: ${outputPath}`)
