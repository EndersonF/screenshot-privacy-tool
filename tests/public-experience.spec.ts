import { expect, test } from '@playwright/test'

test('FAQ mantém uma resposta aberta e funciona com Enter, Espaço e Tab', async ({ page }) => {
  await page.goto('/')
  const questions = page.locator('.faq__question')
  await expect(questions).toHaveCount(5)
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

  for (let index = 0; index < 5; index += 1) {
    const question = questions.nth(index)
    await question.click()
    const panelId = await question.getAttribute('aria-controls')
    await expect(page.locator(`#${panelId}`)).toBeVisible()
    await expect(page.locator('.faq__answer:visible')).toHaveCount(1)
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const duration = await questions.nth(4).locator('svg').evaluate((element) =>
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
