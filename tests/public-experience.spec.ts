import { expect, test } from '@playwright/test'

test('FAQ mantém uma resposta aberta e funciona com Enter, Espaço e Tab', async ({ page }) => {
  await page.goto('/')
  const questions = page.locator('.faq__question')
  await expect(questions).toHaveCount(7)
  await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.faq__answer:visible')).toHaveCount(1)

  await questions.nth(0).focus()
  await page.keyboard.press('Tab')
  await expect(questions.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'false')
  await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.faq__answer:visible')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(page.locator('.faq__answer:visible')).toHaveCount(0)

  for (let index = 0; index < 7; index += 1) {
    const question = questions.nth(index)
    await question.click()
    const panelId = await question.getAttribute('aria-controls')
    await expect(page.locator(`#${panelId}`)).toBeVisible()
    await expect(page.locator('.faq__answer:visible')).toHaveCount(1)
  }

  // Valida que o FAQ de zoom e remoção contém as instruções corretas
  const zoomAnswer = page.locator('#faq-answer-3')
  await expect(zoomAnswer).not.toContainText('dois dedos')
  await expect(zoomAnswer).toContainText('Mover imagem')
  await expect(zoomAnswer).toContainText('desativar')

  const removeAnswer = page.locator('#faq-answer-4')
  await expect(removeAnswer).toContainText('Remover ocultação')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const duration = await questions.last().locator('svg').evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration))
  expect(duration).toBeLessThanOrEqual(0.001)
})

test('âncoras e conteúdo público permanecem acessíveis sem overflow em telas estreitas', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const navigation = page.getByRole('navigation', { name: 'Navegação principal' })
    for (const [label, id] of [['Como funciona', 'como-funciona'], ['Privacidade', 'privacidade']]) {
      await navigation.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#${id}$`))
      const top = await page.locator(`#${id}`).evaluate((element) => element.getBoundingClientRect().top)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top).toBeLessThan(100)
    }
    await page.locator('.faq__question').last().click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const github = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'GitHub' })
  await expect(github).toHaveAttribute('href', 'https://github.com/EndersonF/screenshot-privacy-tool')
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer')
})

test('informações públicas saem de cena ao abrir o editor e retornam com Nova imagem', async ({ page }) => {
  await page.goto('/')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 90
    canvas.getContext('2d')!.fillRect(0, 0, 120, 90)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher arquivo' }).click()
  await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Perguntas frequentes' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copiar imagem protegida' })).toBeVisible()
  await page.getByRole('button', { name: 'Nova imagem' }).click()
  await expect(page.getByRole('heading', { name: 'Perguntas frequentes' })).toBeVisible()
  await expect(page.locator('.faq__question').first()).toHaveAttribute('aria-expanded', 'true')
})

test('metadados de SEO, Open Graph e Twitter Cards estão configurados', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Tampei | Oculte informações em prints e screenshots')

  const description = page.locator('meta[name="description"]')
  await expect(description).toHaveAttribute(
    'content',
    'Oculte dados pessoais em prints e screenshots antes de compartilhar. Aplique tarjas sólidas, amplie a imagem e baixe ou copie o resultado. Grátis e sem upload.',
  )

  const canonical = page.locator('link[rel="canonical"]')
  await expect(canonical).toHaveAttribute('href', 'https://screenshot-privacy-tool.pages.dev/')

  const ogTitle = page.locator('meta[property="og:title"]')
  await expect(ogTitle).toHaveAttribute('content', 'Tampei | Oculte informações em prints e screenshots')

  const ogUrl = page.locator('meta[property="og:url"]')
  await expect(ogUrl).toHaveAttribute('content', 'https://screenshot-privacy-tool.pages.dev/')

  const twitterCard = page.locator('meta[name="twitter:card"]')
  await expect(twitterCard).toHaveAttribute('content', 'summary')

  const html = page.locator('html')
  await expect(html).toHaveAttribute('lang', 'pt-BR')
})

test('robots.txt e sitemap.xml são servidos corretamente', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const robotsText = await robots.text()
  expect(robotsText).toContain('User-agent: *')
  expect(robotsText).toContain('Sitemap: https://screenshot-privacy-tool.pages.dev/sitemap.xml')

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const sitemapText = await sitemap.text()
  expect(sitemapText).toContain('<loc>https://screenshot-privacy-tool.pages.dev/</loc>')
  expect(sitemapText).not.toContain('<changefreq>')
  expect(sitemapText).not.toContain('<priority>')
})
