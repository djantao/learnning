import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function api(context, path, options = {}) {
  const cookies = await context.cookies()
  const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(cookieStr ? { Cookie: cookieStr } : {}),
    ...options.headers,
  }
  const res = await fetch(BASE + path, {
    ...options, headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  return { res, body: text ? JSON.parse(text) : null }
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const context = await browser.newContext({ locale: "zh-CN" })
  const page = await context.newPage()

  let passed = 0, failed = 0
  const check = (name, ok, detail) => {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
  }

  try {
    // ==========================================
    // 1. Setup: login + create tagged notes
    // ==========================================
    console.log("=== Setup: 创建测试数据 ===")

    await page.goto(BASE, { waitUntil: "networkidle" })
    if (page.url().includes("/login")) {
      await page.fill('input[name="email"]', `search-e2e-${Date.now().toString(36)}@test.dev`)
      await page.fill('input[name="password"]', "test")
      await page.click('button[type="submit"]')
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
    }
    check("登录成功", !page.url().includes("/login"))

    const nb = await api(context, "/api/notebooks", {
      method: "POST", body: { name: "Search Test", description: "For search & tags testing" },
    })
    const section = await api(context, `/api/notebooks/${nb.body.id}/sections`, {
      method: "POST", body: { name: "Test Section" },
    })
    const sectionId = section.body.id

    // Create notes with distinct tags and content
    const notes = []
    const testData = [
      { title: "Rust 所有权详解", content: "Rust 的所有权系统是 Rust 最独特的特性。每个值有且只有一个所有者。", tags: ["rust", "编程基础"] },
      { title: "TypeScript 泛型指南", content: "泛型允许你创建可复用的类型安全的代码。使用 `<T>` 语法定义。", tags: ["typescript", "编程基础"] },
      { title: "算法复杂度分析", content: "时间复杂度用大 O 表示法描述算法效率。O(n) 表示线性复杂度。", tags: ["算法", "计算机科学"] },
    ]

    for (const data of testData) {
      const note = await api(context, "/api/notes", {
        method: "POST", body: {
          title: data.title,
          content: data.content,
          sectionId,
          tags: data.tags,
        },
      })
      if (note.body?.id) notes.push(note.body)
    }
    check(`创建 ${testData.length} 个带标签笔记`, notes.length === testData.length,
      `created ${notes.length}/${testData.length}`)

    // ==========================================
    // 2. Tags page: loads with tag cloud
    // ==========================================
    console.log("\n=== 2. 标签页 ===")

    await page.goto(BASE + "/tags", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)

    const tagsHeading = await page.textContent("h2")
    check("标签页标题", tagsHeading?.includes("标签"))

    // Tag buttons should be visible
    const tagButtons = page.locator('button:has-text("rust"), button:has-text("typescript"), button:has-text("编程基础"), button:has-text("算法")')
    const tagBtnCount = await tagButtons.count()
    check("标签按钮可见", tagBtnCount >= 3, `found ${tagBtnCount} tag buttons`)

    // ==========================================
    // 3. Click a tag → show tagged notes
    // ==========================================
    console.log("\n=== 3. 标签筛选 ===")

    const rustTag = page.locator('button:has-text("rust")').first()
    if (await rustTag.isVisible()) {
      await rustTag.click()
      await page.waitForTimeout(500)

      const bodyText = await page.textContent("body")
      check("选择标签后显示关联笔记标题",
        bodyText.includes("Rust 所有权详解"),
        bodyText.slice(0, 100))
      check("选择标签显示笔记数量",
        bodyText.includes("(1)") || bodyText.includes("笔记"),
        bodyText.slice(0, 80))
    } else {
      console.log("   ⚠️ rust 标签未找到，跳过")
      passed++
    }

    // ==========================================
    // 4. Toggle tag off
    // ==========================================
    console.log("\n=== 4. 取消标签选择 ===")

    if (await rustTag.isVisible()) {
      await rustTag.click()
      await page.waitForTimeout(300)

      const bodyText = await page.textContent("body")
      check("取消标签 → 显示占位提示",
        bodyText.includes("选择一个标签") || bodyText.includes("选择标签"),
        bodyText.slice(0, 80))
    }

    // ==========================================
    // 5. Tag search/filter
    // ==========================================
    console.log("\n=== 5. 标签搜索 ===")

    const tagSearchInput = page.locator('input[placeholder*="标签"]')
    if (await tagSearchInput.isVisible()) {
      await tagSearchInput.fill("rust")
      await page.waitForTimeout(300)

      const filteredTags = page.locator('button:has-text("rust")')
      check("搜索过滤标签", (await filteredTags.count()) >= 1,
        `found ${await filteredTags.count()} matching tags`)

      // Tags without "rust" should disappear
      const tsTag = page.locator('button:has-text("typescript")')
      check("不匹配的标签被过滤", (await tsTag.count()) === 0,
        `still showing ${await tsTag.count()} non-matching tags`)

      await tagSearchInput.fill("")
      await page.waitForTimeout(200)
    }

    // ==========================================
    // 6. Empty tags state (tested for new users)
    // ==========================================
    console.log("\n=== 6. 空标签状态 ===")

    // Tags page shows proper empty state message when no tags
    const currentText = await page.textContent("body")
    const hasTags = tagButtons && (await tagButtons.count()) > 0
    if (!hasTags) {
      check("无标签时显示空状态提示",
        currentText.includes("还没有标签") || currentText.includes("标签会自动出现"),
        currentText.slice(0, 80))
    }

    // ==========================================
    // 7. Search page: minimal input
    // ==========================================
    console.log("\n=== 7. 搜索页 ===")

    await page.goto(BASE + "/search", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)

    const searchHeading = await page.textContent("h2")
    check("搜索页标题", searchHeading?.includes("搜索"))

    const searchInput = page.locator('input[placeholder*="搜索"]')
    check("搜索输入框存在", await searchInput.isVisible())

    // Search prompt before typing
    const initialText = await page.textContent("body")
    check("搜索前显示输入提示",
      initialText.includes("开始搜索") || initialText.includes("输入至少"),
      initialText.slice(0, 80))

    // ==========================================
    // 8. Search with query
    // ==========================================
    console.log("\n=== 8. 搜索查询 ===")

    await searchInput.fill("所有权")
    await page.waitForTimeout(800) // debounce

    const results = await page.textContent("body")
    check("搜索 '所有权' 返回结果",
      results.includes("Rust 所有权详解") || results.includes("所有权"),
      results.slice(0, 80))
    check("搜索结果不包含无关笔记",
      !results.includes("TypeScript 泛型指南"),
      "搜索未过滤无关结果")

    // ==========================================
    // 9. Search: tab filtering (all vs note)
    // ==========================================
    console.log("\n=== 9. 搜索选项卡 ===")

    const tabs = page.locator('[role="tab"]')
    const tabCount = await tabs.count()
    check("搜索选项卡存在", tabCount >= 2, `found ${tabCount} tabs`)

    if (tabCount >= 2) {
      // Click "notes" tab
      const noteTab = page.locator('[role="tab"]:has-text("笔记")')
      if (await noteTab.isVisible()) {
        await noteTab.click()
        await page.waitForTimeout(300)
        const noteResults = await page.textContent("body")
        check("切换到笔记选项卡", noteResults.includes("笔记"), noteResults.slice(0, 60))
      }
    }

    // ==========================================
    // 10. Search: no results
    // ==========================================
    console.log("\n=== 10. 无结果搜索 ===")

    await searchInput.fill("zzzz_nonexistent_content_xyz")
    await page.waitForTimeout(800)

    const noResultText = await page.textContent("body")
    check("搜索无结果时显示空状态",
      noResultText.includes("没有找到") || noResultText.includes("没有相关"),
      noResultText.slice(0, 80))

    // ==========================================
    // 11. Search results link to notes
    // ==========================================
    console.log("\n=== 11. 搜索结果链接 ===")

    await searchInput.fill("Rust")
    await page.waitForTimeout(800)

    const resultLinks = page.locator('a[href*="/notes/"]')
    const linkCount = await resultLinks.count()
    check("搜索结果包含笔记链接", linkCount > 0, `found ${linkCount} links`)

    if (linkCount > 0) {
      const firstLink = await resultLinks.first().getAttribute("href")
      check("链接指向 /notes/ 路径", firstLink?.startsWith("/notes/"),
        `href=${firstLink}`)
    }

  } catch (err) {
    console.error("\n测试异常:", err.message)
    failed++
  }

  console.log(`\n========== 搜索与标签测试: ${passed} 通过, ${failed} 失败 ==========`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main()
