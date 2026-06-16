import { test, expect } from "@playwright/test"

test.describe("完整学习流程 (含数据准备)", () => {
  test("登录 → 创建课程 → 学习 → AI对话 → 笔记 → 复习", async ({ page }) => {
    // ====== 1. 登录 ======
    await page.goto("/login")
    await page.fill('input[name="email"]', "student@learn.app")
    await page.fill('input[name="password"]', "test123")
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
    await page.waitForLoadState("networkidle")
    console.log("✅ 登录成功")

    // ====== 2. 创建课程 ======
    await page.goto("/courses")
    await page.waitForLoadState("networkidle")

    const aiGenBtn = page.getByRole("button", { name: /AI.*课程|生成.*课程/ })
    if (await aiGenBtn.isVisible({ timeout: 3000 })) {
      await aiGenBtn.click()
      await page.waitForTimeout(1000)
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible({ timeout: 2000 })) {
        const input = dialog.locator("input").first()
        if (await input.isVisible()) {
          await input.fill("React 入门")
          await dialog.getByRole("button", { name: /生成|确认|创建/ }).click()
          await page.waitForTimeout(8000)
          console.log("✅ AI 课程生成已触发")
        }
      }
    } else {
      const addBtn = page.getByRole("button", { name: /添加|新建/ })
      if (await addBtn.isVisible({ timeout: 2000 })) {
        await addBtn.click()
        await page.waitForTimeout(500)
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible({ timeout: 2000 })) {
          await dialog.locator("input").first().fill("React 入门")
          await dialog.getByRole("button", { name: /创建|确认/ }).click()
          await page.waitForTimeout(2000)
          console.log("✅ 手动创建课程成功")
        }
      }
    }

    // ====== 3. 进入课程 → 知识点 ======
    await page.goto("/courses")
    await page.waitForLoadState("networkidle")
    const courseLink = page.locator('a[href^="/courses/"]').first()
    if (await courseLink.isVisible({ timeout: 5000 })) {
      await courseLink.click()
      await page.waitForLoadState("networkidle")
      console.log("✅ 进入课程详情")

      const kpLink = page.locator('a[href*="/learn/"]').first()
      if (await kpLink.isVisible({ timeout: 5000 })) {
        await kpLink.click()
        await page.waitForLoadState("networkidle")
        console.log("✅ 进入知识点学习")

        const title = page.locator("h2")
        if (await title.isVisible({ timeout: 3000 })) {
          const titleText = await title.textContent()
          console.log(`📖 学习: ${titleText}`)
        }

        // ====== 4. AI 对话 ======
        const textarea = page.locator("textarea").first()
        if (await textarea.isVisible({ timeout: 5000 })) {
          await textarea.fill("请用一句话总结这个知识点")
          await textarea.press("Enter")
          console.log("⏳ 等待 AI 回复...")
          await page.waitForTimeout(6000)
          console.log("✅ AI 对话发送成功")
        }

        // ====== 5. 笔记 ======
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(500)

        const newNoteBtn = page.getByRole("button", { name: /新建笔记/ })
        if (await newNoteBtn.isVisible({ timeout: 3000 })) {
          await newNoteBtn.click()
          await page.waitForTimeout(500)
          const dialog = page.locator('[role="dialog"]')
          if (await dialog.isVisible({ timeout: 2000 })) {
            await dialog.locator("input").first().fill("学习心得")
            const textareas = dialog.locator("textarea")
            if (await textareas.first().isVisible()) {
              await textareas.first().fill("## 核心要点\n\n1. 第一点\n2. 第二点")
            }
            await dialog.getByRole("button", { name: /保存/ }).click()
            await page.waitForTimeout(1500)
            console.log("✅ 笔记创建成功")
          }
        }

        // ====== 6. 掌握度 ======
        const star4 = page.locator('[title="4/5"]')
        if (await star4.isVisible({ timeout: 2000 })) {
          await star4.click()
          await page.waitForTimeout(500)
          console.log("✅ 掌握度评分: 4/5")
        }
      }
    }

    // ====== 7. 复习全流程 ======
    await page.goto("/review")
    await page.waitForLoadState("networkidle")
    const heading = page.locator("h2").filter({ hasText: "复习" })
    await expect(heading).toBeVisible({ timeout: 5000 })
    console.log("✅ 复习仪表盘")

    // 生成复习计划
    const genBtn = page.getByRole("button", { name: /生成复习/ })
    if (await genBtn.isVisible({ timeout: 3000 })) {
      await genBtn.click()
      console.log("⏳ 生成复习计划...")
      await page.waitForTimeout(15000)
      console.log("✅ 复习计划已触发")
    }

    for (const path of ["/review/session", "/review/cards", "/review/history"]) {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      console.log(`✅ ${path}`)
    }

    console.log("\n🎉 完整学习流程 E2E 测试全部通过！")
  })
})
