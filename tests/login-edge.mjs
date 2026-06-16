import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const page = await browser.newPage({ locale: "zh-CN" })

  let passed = 0, failed = 0
  const check = (name, ok, detail) => {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
  }

  try {
    // ==========================================
    // 1. 未认证 → 重定向到登录页
    // ==========================================
    console.log("\n=== 1. 认证守卫 ===")
    await page.goto(BASE, { waitUntil: "networkidle" })
    check("访问首页 → 重定向到 /login", page.url().includes("/login"), page.url())

    // Protected pages redirect to login
    const protectedPaths = [
      "/chat", "/settings", "/review/session", "/notes/new",
      "/goals", "/graph", "/search", "/tags", "/notebooks",
    ]
    for (const path of protectedPaths) {
      await page.goto(BASE + path, { waitUntil: "networkidle" })
      await page.waitForTimeout(400)
      check(`${path} → 重定向到登录页`, page.url().includes("/login"), page.url())
    }

    // ==========================================
    // 2. 登录表单 UI 完整性
    // ==========================================
    console.log("\n=== 2. 登录表单 UI ===")
    await page.goto(BASE + "/login", { waitUntil: "networkidle" })
    await page.waitForTimeout(300)

    const titleEl = page.locator('h2')
    check("页面标题显示 'MindForge'", (await titleEl.textContent())?.includes("MindForge"))

    const emailInput = page.locator('input[name="email"]')
    const pwInput = page.locator('input[name="password"]')
    const submitBtn = page.locator('button[type="submit"]')

    check("邮箱输入框存在", await emailInput.isVisible())
    check("密码输入框存在", await pwInput.isVisible())
    check("提交按钮存在", await submitBtn.isVisible())
    check("邮箱字段有 required 属性", (await emailInput.getAttribute("required")) !== null)

    const emailType = await emailInput.getAttribute("type")
    check("邮箱字段 type=email", emailType === "email", `type=${emailType}`)

    const pwType = await pwInput.getAttribute("type")
    check("密码字段 type=password", pwType === "password", `type=${pwType}`)

    // ==========================================
    // 3. 空表单提交
    // ==========================================
    console.log("\n=== 3. 空表单提交 ===")

    // Clear and submit (browser native validation should kick in)
    await emailInput.fill("")
    await pwInput.fill("")

    // Check that required constraint validation works
    const willValidate = await emailInput.evaluate((el) => el.validity.valid)
    check("空邮箱触发浏览器验证 (validity.valid=false)", !willValidate)

    // ==========================================
    // 4. 无效邮箱格式
    // ==========================================
    console.log("\n=== 4. 无效邮箱格式 ===")

    await emailInput.fill("not-an-email")
    await pwInput.fill("test")
    await submitBtn.click()
    await page.waitForTimeout(500)

    // Browser should prevent submission or page should stay on login
    const stillOnLogin = page.url().includes("/login")
    check("无效邮箱 → 留在登录页", stillOnLogin, page.url())

    // ==========================================
    // 5. 正常注册/登录 → 原型自动创建账号
    // ==========================================
    console.log("\n=== 5. 正常登录/注册 ===")

    const testEmail = `edge-test-${Date.now().toString(36)}@test.dev`
    await emailInput.fill(testEmail)
    await pwInput.fill("test")

    // Listen for console errors during login
    const errors = []
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()) })

    await submitBtn.click()
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
    await page.waitForTimeout(500)

    check("新邮箱自动创建账号并登录", page.url() === BASE + "/" || page.url() === BASE,
      page.url())
    check("登录过程无 console 错误", errors.length === 0,
      errors.length > 0 ? errors[0].slice(0, 80) : undefined)

    const bodyText = await page.textContent("body")
    check("仪表盘包含欢迎信息", bodyText.includes("欢迎回来") || bodyText.includes("学习"))

    // ==========================================
    // 6. 已登录用户访问 /login → 重定向到 /
    // ==========================================
    console.log("\n=== 6. 已登录重定向 ===")

    await page.goto(BASE + "/login", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("已登录访问 /login → 重定向到 /", !page.url().includes("/login"), page.url())

    // ==========================================
    // 7. 重复登录（相同邮箱）→ 无错误
    // ==========================================
    console.log("\n=== 7. 重复登录 ===")

    // Sign out by clearing cookies (simulate new session)
    await page.context().clearCookies()
    await page.goto(BASE + "/login", { waitUntil: "networkidle" })
    await page.waitForTimeout(300)

    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', "test")
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })

    check("重复登录成功 (无重复注册错误)", !page.url().includes("/login"), page.url())

    // ==========================================
    // 8. XSS 防护：script 标签不应执行
    // ==========================================
    console.log("\n=== 8. 输入清理 ===")

    // Logout first
    await page.context().clearCookies()
    await page.goto(BASE + "/login", { waitUntil: "networkidle" })
    await page.waitForTimeout(300)

    const xssPayload = '<script>window.__xssTest=true</script>'
    await page.fill('input[name="email"]', xssPayload + "@test.dev")
    await page.fill('input[name="password"]', xssPayload)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)

    const xssExecuted = await page.evaluate(() => !!(window).__xssTest)
    check("XSS payload 未执行", !xssExecuted,
      xssExecuted ? "script was executed — potential XSS vulnerability" : undefined)

  } catch (err) {
    console.error("\n测试异常:", err.message)
    failed++
  }

  console.log(`\n========== 登录边界测试: ${passed} 通过, ${failed} 失败 ==========`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main()
