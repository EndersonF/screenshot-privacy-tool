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
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth')
    for (const [label, id] of [['Como funciona', 'como-funciona'], ['Privacidade', 'privacidade']]) {
      await navigation.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#${id}$`))
      await expect.poll(async () => {
        const top = await page.locator(`#${id}`).evaluate((element) => element.getBoundingClientRect().top)
        return top >= 0 && top < 100
      }).toBe(true)
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
  await expect(canonical).toHaveAttribute('href', 'https://tampei.endersonfrazao.com/')

  const ogTitle = page.locator('meta[property="og:title"]')
  await expect(ogTitle).toHaveAttribute('content', 'Tampei | Oculte informações em prints e screenshots')

  const ogUrl = page.locator('meta[property="og:url"]')
  await expect(ogUrl).toHaveAttribute('content', 'https://tampei.endersonfrazao.com/')

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
  expect(robotsText).toContain('Sitemap: https://tampei.endersonfrazao.com/sitemap.xml')

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const sitemapText = await sitemap.text()
  expect(sitemapText).toContain('<loc>https://tampei.endersonfrazao.com/</loc>')
  expect(sitemapText).not.toContain('<changefreq>')
  expect(sitemapText).not.toContain('<priority>')
})

test('seção Como funciona exibe comparativo estático Antes e Depois com assets locais e layout responsivo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const dropzone = page.getByRole('region', { name: 'Área para colar ou arrastar uma imagem' })
  const howSection = page.locator('#como-funciona')
  await expect(dropzone).toBeVisible()
  await expect(howSection).toBeVisible()

  const dropzoneTop = await dropzone.evaluate((el) => el.getBoundingClientRect().top)
  const howTop = await howSection.evaluate((el) => el.getBoundingClientRect().top)
  expect(dropzoneTop).toBeLessThan(howTop)

  await expect(howSection.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeVisible()
  await expect(howSection.getByRole('heading', { level: 3, name: 'Você escolhe o que fica visível.' })).toBeVisible()
  await expect(howSection.locator('.how-description')).toHaveText(
    'Adicione a imagem, selecione o que deseja ocultar e confirme. Revise o resultado antes de compartilhar.',
  )
  await expect(howSection.locator('.how-flow')).toHaveText('Adicione. Oculte. Compartilhe.')

  const figure = howSection.locator('figure.how-demo')
  await expect(figure).toBeVisible()
  await expect(figure.locator('figcaption')).toHaveText('Conversa fictícia. Ocultações manuais no Tampei.')

  const labels = figure.locator('.how-example__label')
  await expect(labels).toHaveCount(2)
  await expect(labels.nth(0)).toContainText('Antes')
  await expect(labels.nth(0)).toContainText('Imagem original')
  await expect(labels.nth(1)).toContainText('Depois')
  await expect(labels.nth(1)).toContainText('No Tampei')

  const beforeImg = figure.getByRole('img', { name: 'Conversa fictícia de atendimento com e-mail e telefone visíveis.' })
  const afterImg = figure.getByRole('img', { name: 'A mesma conversa, com tarjas pretas sobre o e-mail e o telefone.' })

  await expect(beforeImg).toHaveAttribute('src', '/demo-original.png')
  await expect(beforeImg).toHaveAttribute('width', '400')
  await expect(beforeImg).toHaveAttribute('height', '440')
  await expect(afterImg).toHaveAttribute('src', '/demo-protected.png')
  await expect(afterImg).toHaveAttribute('width', '400')
  await expect(afterImg).toHaveAttribute('height', '440')

  await beforeImg.scrollIntoViewIfNeeded()
  await expect.poll(() => beforeImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 400 && img.naturalHeight === 440)).toBe(true)
  await expect.poll(() => afterImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 400 && img.naturalHeight === 440)).toBe(true)

  // Apenas uma região de anúncio global na página
  await expect(page.locator('[role="status"]')).toHaveCount(1)
  await expect(howSection.locator('[aria-live], [role="status"]')).toHaveCount(0)

  // No desktop (1440x900), Antes e Depois ficam lado a lado
  const desktopBeforeBox = (await beforeImg.boundingBox())!
  const desktopAfterBox = (await afterImg.boundingBox())!
  expect(Math.abs(desktopBeforeBox.y - desktopAfterBox.y)).toBeLessThan(4)
  expect(desktopAfterBox.x).toBeGreaterThan(desktopBeforeBox.x + desktopBeforeBox.width)

  // No mobile (320, 375, 390), Antes e Depois ficam empilhados sem overflow
  for (const [width, height] of [[320, 568], [375, 667], [390, 844]] as const) {
    await page.setViewportSize({ width, height })
    const mobileBeforeBox = (await beforeImg.boundingBox())!
    const mobileAfterBox = (await afterImg.boundingBox())!
    expect(mobileAfterBox.y).toBeGreaterThan(mobileBeforeBox.y + mobileBeforeBox.height)
    expect(Math.abs(mobileBeforeBox.x - mobileAfterBox.x)).toBeLessThan(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
