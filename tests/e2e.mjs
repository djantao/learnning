import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const page = await browser.newPage()

  let passed = 0, failed = 0
  const check = (name, ok, detail) => {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
  }

  async function apiGet(path) {
    const cookies = await page.context().cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(BASE + path, { headers: { Cookie: cookieStr } })
    return res.json()
  }

  async function apiPost(path, body) {
    const cookies = await page.context().cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  try {
    // ==========================================
    // 流程 1: 认证
    // ==========================================
    console.log("\n=== 流程 1: 登录认证 ===")
    await page.goto(BASE, { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    const onLogin = page.url().includes("/login")
    check("访问首页 → 重定向到登录页", onLogin, page.url())

    await page.fill('input[name="email"]', "e2e@test.dev")
    await page.fill('input[name="password"]', "test")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1500)
    const loggedIn = page.url() === BASE + "/" || page.url() === BASE
    check("登录成功 → 进入仪表盘", loggedIn, page.url())

    // ==========================================
    // 流程 2: 设置学习档案 + 指令锚点
    // ==========================================
    console.log("\n=== 流程 2: 设置 AI 记忆 ===")
    await page.goto(BASE + "/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)

    // Fill profile
    await page.fill('#learningGoals', "学习 Rust 系统编程，目标写出生产级后端服务")
    await page.fill('#knowledgeLevel', "Rust 入门，TypeScript 专家，熟悉 Linux")
    await page.fill('#preferredStyle', "用生活类比解释，配合代码示例，先结论后展开")
    await page.click('text=保存设置')
    await page.waitForTimeout(1000)

    // Verify profile saved via API
    const profile = await apiGet("/api/profile")
    check("学习档案已保存", profile && profile.learningGoals && profile.learningGoals.length > 0,
      "learningGoals: " + (profile?.learningGoals?.slice(0, 30) || "null"))

    // Add an instruction anchor
    const anchorRes = await apiPost("/api/anchors", {
      anchors: [{
        title: "始终使用中文",
        instruction: "除非我明确要求，所有回复必须使用中文。代码注释也尽量中文。",
        category: "language",
        priority: 10,
        isActive: true,
      }]
    })
    check("指令锚点已保存", Array.isArray(anchorRes) && anchorRes.length > 0,
      "anchors: " + anchorRes.length)

    // ==========================================
    // 流程 3: 创建笔记本 → 章节 → 笔记
    // ==========================================
    console.log("\n=== 流程 3: 知识库操作 ===")

    // Create notebook
    const notebook = await apiPost("/api/notebooks", {
      name: "Rust 学习笔记",
      description: "系统学习 Rust 编程语言"
    })
    const notebookId = notebook?.id
    check("创建笔记本", !!notebookId, "id: " + (notebookId || "null"))

    // Create section
    const sectionRes = await apiPost(`/api/notebooks/${notebookId}/sections`, {
      name: "所有权与借用"
    })
    const sectionId = sectionRes?.id
    check("创建章节", !!sectionId, "id: " + (sectionId || "null"))

    // Create note with wiki-links
    const note = await apiPost("/api/notes", {
      title: "Rust 所有权核心概念",
      content: `# Rust 所有权

## 核心规则

1. Rust 中每个值有且只有一个**所有者**
2. 所有者离开作用域，值被**自动释放**
3. 借用分为 &T (不可变) 和 &mut T (可变)

## 代码示例

\`\`\`rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;  // s1 所有权转移给 s2
    println!("{}", s2);  // OK
    // println!("{}", s1);  // 编译错误！
}
\`\`\`

此概念与 [[内存管理对比]] 和 [[生命周期入门]] 相关。`,
      sectionId: sectionId,
      tags: ["rust", "ownership", "memory"],
    })
    const noteId = note?.id
    check("创建笔记（含 Markdown + 双向链接 + 标签）", !!noteId && note.wordCount > 0,
      `id=${noteId?.slice(0,12)}... words=${note.wordCount}`)

    // Verify note exists
    const noteDetail = await apiGet(`/api/notes/${noteId}`)
    check("笔记详情可读取", noteDetail?.title && noteDetail?.tags?.length > 0,
      `title=${noteDetail?.title?.slice(0,20)}... tags=${noteDetail?.tags?.length}`)

    // ==========================================
    // 流程 4: 创建学习目标 + 关联笔记
    // ==========================================
    console.log("\n=== 流程 4: 学习目标联动 ===")

    const goal = await apiPost("/api/goals", {
      title: "掌握 Rust 所有权系统",
      description: "理解并应用所有权、借用、生命周期三大概念",
    })
    const goalId = goal?.id
    check("创建学习目标", !!goalId, "id: " + (goalId || "null"))

    // Link note as material
    await apiPost(`/api/goals/${goalId}/materials`, { pageId: noteId })
    const goalDetail = await apiGet(`/api/goals/${goalId}`)
    check("学习目标关联笔记成功", goalDetail?.materials?.length > 0,
      `materials: ${goalDetail?.materials?.length}`)

    // ==========================================
    // 流程 5: AI 生成闪卡
    // ==========================================
    console.log("\n=== 流程 5: AI 闪卡生成 ===")

    const flashRes = await apiPost("/api/ai/generate-flashcards", { noteId })
    const cardCount = flashRes?.count || 0
    check("AI 从笔记生成闪卡", cardCount > 0, `生成了 ${cardCount} 张闪卡`)
    if (flashRes?.error) {
      console.log(`    (AI 生成: ${flashRes.error})`)
    }

    // ==========================================
    // 流程 6: 复习流程 (SM-2)
    // ==========================================
    console.log("\n=== 流程 6: 间隔复习 ===")

    // Get due cards
    const dueData = await apiGet("/api/review/due")
    const dueCount = dueData?.count || 0
    check("有待复习的闪卡", dueCount > 0, `due: ${dueCount} 张`)

    if (dueCount > 0) {
      // Create review session
      const session = await apiPost("/api/review/sessions", {})
      const sessionId = session?.id
      check("创建复习会话", !!sessionId)

      // Grade 3 cards with different scores
      let gradedCount = 0
      const cardsToGrade = dueData.cards.slice(0, 3)
      const grades = [5, 4, 3] // perfect, good, correct-with-difficulty

      for (let i = 0; i < cardsToGrade.length; i++) {
        const card = cardsToGrade[i]
        const grade = grades[i]
        const result = await apiPost("/api/review/grade", {
          cardId: card.id,
          grade,
          sessionId,
        })
        if (result?.sm2Interval !== undefined) {
          gradedCount++
          console.log(`    卡片${i+1}: 评分${grade} → 间隔${result.sm2Interval}天 易度${result.sm2Efactor?.toFixed(1)}`)
        }
      }
      check(`完成 ${gradedCount} 次闪卡评分`, gradedCount === 3, `expected 3, got ${gradedCount}`)

      // Verify SM-2 algorithm works correctly
      const firstCard = dueData.cards[0]
      const firstCardAfter = (await apiGet("/api/review/due")).cards.find(c => c.id === firstCard.id)
      check("已评分卡片不再出现在待复习列表（间隔正确）",
        !firstCardAfter,
        firstCardAfter ? `still due with interval=${firstCardAfter.sm2Interval}` : "correctly removed")
    }

    // ==========================================
    // 流程 7: 目标进度自动更新
    // ==========================================
    console.log("\n=== 流程 7: 目标进度自动更新 ===")

    const updatedGoal = await apiGet(`/api/goals/${goalId}`)
    const progress = updatedGoal?.progressPct || 0
    const status = updatedGoal?.status || "unknown"

    if (cardCount > 0) {
      check("目标进度已自动计算（非 0%）", progress > 0 || status === "in_progress",
        `progress=${progress}% status=${status}`)
    }
    check("目标状态不为 not_started", status !== "not_started",
      `status=${status}`)

    // ==========================================
    // 流程 8: 仪表盘数据校验
    // ==========================================
    console.log("\n=== 流程 8: 仪表盘数据完整性 ===")

    await page.goto(BASE, { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    const bodyText = await page.textContent("body")
    await page.screenshot({ path: "tests/screenshots/08-dashboard-final.png", fullPage: true })

    check("仪表盘显示欢迎信息", bodyText.includes("欢迎回来") || bodyText.includes("e2e"))
    check("仪表盘显示笔记本入口", bodyText.includes("笔记本"))
    check("仪表盘显示目标区域", bodyText.includes("学习目标") || bodyText.includes("目标"))

    // ==========================================
    // 流程 9: 搜索功能
    // ==========================================
    console.log("\n=== 流程 9: 页面完整性 ===")
    await page.goto(BASE + "/search", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("搜索页正常加载", !page.url().includes("/login"))

    await page.goto(BASE + "/graph", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("知识图谱页正常加载", !page.url().includes("/login"))

    await page.goto(BASE + "/review/session", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("复习会话页正常加载", !page.url().includes("/login"))

    await page.goto(BASE + "/chat", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    check("AI 聊天页正常加载", !page.url().includes("/login"))

    await page.goto(BASE + "/goals", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)
    const goalsText = await page.textContent("body")
    check("目标页显示已创建的目标", goalsText.includes("掌握 Rust 所有权系统") || goalsText.includes("所有权系统"))

  } catch (err) {
    console.error("\n测试异常:", err.message)
    failed++
  }

  console.log(`\n========== 端到端测试: ${passed} 通过, ${failed} 失败 ==========`)
  await browser.close()
  process.exit(failed > 0 ? 1 : 0)
}

main()
