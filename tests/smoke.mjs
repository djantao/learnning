import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const context = await browser.newContext({ locale: "zh-CN" })
  const page = await context.newPage()

  let passed = 0
  let failed = 0
  const check = (name, ok) => { if (ok) { passed++; console.log(`  ✅ ${name}`) } else { failed++; console.log(`  ❌ ${name}`) } }

  try {
    // 1. 访问首页 → 应重定向到 /login
    console.log("\n=== 1. 认证流程 ===")
    await page.goto(BASE, { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    check("首页重定向到 /login", page.url().includes("/login"))
    await page.screenshot({ path: "tests/screenshots/01-login.png", fullPage: true })

    // 2. 登录
    await page.fill('input[name="email"]', "test@mindforge.dev")
    await page.fill('input[name="password"]', "test")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    check("登录成功进入仪表盘", page.url() === BASE + "/" && !page.url().includes("/login"))
    await page.screenshot({ path: "tests/screenshots/02-dashboard.png", fullPage: true })

    // 3. 检查仪表盘关键元素
    console.log("\n=== 2. 仪表盘 ===")
    const dashboardText = await page.textContent("body")
    check("显示欢迎信息", dashboardText.includes("欢迎回来"))
    check("有待复习卡片", dashboardText.includes("待复习") || dashboardText.includes("复习"))
    check("有笔记本入口", dashboardText.includes("笔记本"))

    // 4. 导航到笔记本
    console.log("\n=== 3. 笔记本 ===")
    await page.click('a[href="/notebooks"]')
    await page.waitForTimeout(1000)
    check("笔记本页面加载", page.url().includes("/notebooks"))
    await page.screenshot({ path: "tests/screenshots/03-notebooks.png", fullPage: true })

    // 5. 导航到设置
    console.log("\n=== 4. 设置页 ===")
    await page.goto(BASE + "/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    const settingsText = await page.textContent("body")
    check("设置页加载", settingsText.includes("学习档案") || settingsText.includes("设置"))
    await page.screenshot({ path: "tests/screenshots/04-settings.png", fullPage: true })

    // 6. 导航到 AI 聊天
    console.log("\n=== 5. AI 聊天页 ===")
    await page.goto(BASE + "/chat", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    const chatText = await page.textContent("body")
    check("聊天页加载", chatText.includes("AI") || chatText.includes("学习助手") || chatText.includes("对话"))
    await page.screenshot({ path: "tests/screenshots/05-chat.png", fullPage: true })

    // 7. 复习页
    console.log("\n=== 6. 复习页 ===")
    await page.goto(BASE + "/review", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("复习页加载", page.url().includes("/review"))
    await page.screenshot({ path: "tests/screenshots/06-review.png", fullPage: true })

    // 8. 知识图谱
    console.log("\n=== 7. 其他页面 ===")
    await page.goto(BASE + "/graph", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("知识图谱页加载", page.url().includes("/graph"))

    await page.goto(BASE + "/goals", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("学习目标页加载", page.url().includes("/goals"))

    await page.goto(BASE + "/search", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("搜索页加载", page.url().includes("/search"))

  } catch (err) {
    console.error("测试异常:", err.message)
    failed++
  }

  console.log(`\n========== 结果: ${passed} 通过, ${failed} 失败 ==========`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main()
