import { chromium } from "playwright"

const BASE = "http://localhost:3000"

// Mobile viewport sizes
const VIEWPORTS = {
  iphoneSE: { width: 375, height: 667 },
  iphone14: { width: 390, height: 844 },
  ipad: { width: 820, height: 1180 },
  pixel5: { width: 393, height: 851 },
}

async function loginOnDevice(context, page, email = "mobile-e2e@test.dev") {
  await page.goto(BASE, { waitUntil: "networkidle" })
  if (page.url().includes("/login")) {
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "test")
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
  }
}

async function testViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: "zh-CN" })
  const page = await context.newPage()

  let passed = 0, failed = 0
  const check = (label, ok, detail) => {
    if (ok) { passed++; console.log(`    ✅ ${label}`) }
    else { failed++; console.log(`    ❌ ${label}${detail ? ' — ' + detail : ''}`) }
  }

  console.log(`\n  [${name} ${viewport.width}x${viewport.height}]`)

  // --- Login page ---
  await page.goto(BASE, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)

  const loginForm = page.locator('form')
  check("登录表单可见", await loginForm.isVisible())

  const emailInput = page.locator('input[name="email"]')
  const pwInput = page.locator('input[name="password"]')
  check("邮箱输入框可见", await emailInput.isVisible())
  check("密码输入框可见", await pwInput.isVisible())

  const submitBtn = page.locator('button[type="submit"]')
  check("登录按钮可见", await submitBtn.isVisible())

  // Verify inputs are tappable on small screens
  await emailInput.tap()
  await emailInput.fill("mobile-test@test.dev")
  const emailVal = await emailInput.inputValue()
  check("邮箱输入正常", emailVal === "mobile-test@test.dev")

  await pwInput.tap()
  await pwInput.fill("test")
  const pwVal = await pwInput.inputValue()
  check("密码输入正常", pwVal === "test")

  await submitBtn.tap()
  await page.waitForTimeout(1500)
  check("登录后可进入应用", !page.url().includes("/login"), page.url())

  // --- Dashboard ---
  const bodyText = await page.textContent("body")
  check("仪表盘可见", bodyText.includes("欢迎回来") || bodyText.includes("学习"))

  // Verify stat cards stack on mobile (single column)
  const statCards = page.locator('.grid-cols-1')
  check("移动端统计卡片单列布局", await statCards.count() > 0,
    `found ${await statCards.count()} single-col grids`)

  // --- Navigation: check hamburger/sidebar behavior ---
  // On mobile, the sidebar may be collapsed
  const sidebarLinks = page.locator('nav a, [role="navigation"] a')
  const linkCount = await sidebarLinks.count()
  check(`导航链接存在 (${linkCount} 个)`, linkCount > 0,
    `found ${linkCount} navigation links`)

  // --- Notebooks page ---
  await page.goto(BASE + "/notebooks", { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  check("笔记本页在移动端正常加载", !page.url().includes("/login"), page.url())

  // --- Review session page ---
  await page.goto(BASE + "/review/session", { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  const reviewText = await page.textContent("body")
  check("复习页在移动端正常加载",
    reviewText.includes("复习") || reviewText.includes("卡片") || reviewText.includes("待复习"),
    reviewText.slice(0, 50))

  // --- Settings page ---
  await page.goto(BASE + "/settings", { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  const settingsForm = page.locator('form, input, textarea, button').first()
  check("设置页表单元素可见", await settingsForm.isVisible())

  // --- Chat page ---
  await page.goto(BASE + "/chat", { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  check("聊天页在移动端正常加载", !page.url().includes("/login"))

  // --- Touch targets: verify buttons are at least 44px (Apple HIG) ---
  const buttons = page.locator('button:not([class*="ghost"]):not([class*="text-"])')
  const btnCount = await buttons.count()
  let smallTargets = 0
  for (let i = 0; i < Math.min(btnCount, 10); i++) {
    const box = await buttons.nth(i).boundingBox()
    if (box && (box.height < 40 || box.width < 40)) {
      smallTargets++
    }
  }
  check("触摸目标尺寸合适 (≥40px)", smallTargets <= 2,
    `${smallTargets}/${Math.min(btnCount, 10)} buttons too small`)

  await context.close()
  return { passed, failed }
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  let totalPassed = 0, totalFailed = 0

  console.log("=== 移动端响应式 E2E 测试 ===\n")

  try {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const { passed, failed } = await testViewport(browser, name, viewport)
      totalPassed += passed
      totalFailed += failed
    }

    // --- Orientation test: landscape ---
    console.log("\n  [横屏模式 844x390]")
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, locale: "zh-CN" })
    const page = await ctx.newPage()

    await loginOnDevice(ctx, page)
    const landscapeCards = page.locator('.md\\:grid-cols-2, .lg\\:grid-cols-2, .lg\\:grid-cols-4')
    const count = await landscapeCards.count()
    if (count > 0) { totalPassed++; console.log("    ✅ 横屏多列布局生效") }
    else { totalFailed++; console.log("    ❌ 横屏布局未适配") }

    await ctx.close()

  } catch (err) {
    console.error("\n测试异常:", err.message)
    totalFailed++
  }

  console.log(`\n========== 移动端测试: ${totalPassed} 通过, ${totalFailed} 失败 ==========`)
  await browser.close()
  process.exit(totalFailed > 0 ? 1 : 0)
}

main()
