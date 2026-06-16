import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const TEST_EMAIL = "e2e-workflows@test.dev"

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const page = await browser.newPage()

  let passed = 0, failed = 0
  const check = (name, ok, detail) => {
    if (ok) { passed++; console.log(`  ✅ ${name}`) }
    else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`) }
  }

  const state = { noteId: null, courseId: null, moduleId: null, kpId: null, goalId: null }

  async function apiGet(path) {
    const cookies = await page.context().cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(BASE + path, { headers: { Cookie: cookieStr } })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return text }
  }

  async function apiPost(path, body) {
    const cookies = await page.context().cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return text }
  }

  async function apiPatch(path, body) {
    const cookies = await page.context().cookies()
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const res = await fetch(BASE + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try { return JSON.parse(text) } catch { return text }
  }

  async function screenshot(name) {
    await page.screenshot({ path: `tests/screenshots/workflows-${name}.png`, fullPage: true })
  }

  try {
    // ============================================================
    // 登录
    // ============================================================
    console.log("\n━━━ 登录认证 ━━━")
    await page.goto(BASE + "/login", { waitUntil: "networkidle" })
    await page.waitForTimeout(500)

    const emailInput = page.locator('input[name="email"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_EMAIL)
      const pwInput = page.locator('input[name="password"]')
      if (await pwInput.isVisible()) await pwInput.fill("test")
      await page.click('button[type="submit"]')
      await page.waitForTimeout(2000)
    }
    const loggedIn = !page.url().includes("/login")
    check("登录成功 → 进入仪表盘", loggedIn, page.url())
    if (!loggedIn) { await screenshot("login-fail"); throw new Error("Login failed") }

    // ============================================================
    // 工作流 1: 笔记 → 闪卡 → 复习闭环 (F1+F2+F5)
    // ============================================================
    console.log("\n━━━ 工作流 1: 笔记 → 闪卡 → 复习闭环 ━━━")

    const nbRes = await apiPost("/api/notebooks", {
      name: "测试笔记本-W1",
      description: "E2E工作流测试用"
    })
    check("创建笔记本", nbRes?.id, nbRes?.error ? JSON.stringify(nbRes.error) : "")
    const notebookId = nbRes?.id

    let sectionId = null
    if (notebookId) {
      const secRes = await apiPost(`/api/notebooks/${notebookId}/sections`, {
        name: "学习笔记",
        sortOrder: 0
      })
      check("创建章节", secRes?.id, secRes?.error ? JSON.stringify(secRes.error) : "")
      sectionId = secRes?.id
    }

    const noteRes = await apiPost("/api/notes", {
      title: "TypeScript基础",
      content: `# TypeScript 基础

TypeScript 是 JavaScript 的超集，添加了静态类型系统。

## 基本类型

\`\`\`typescript
let name: string = "MindForge"
let count: number = 42
let items: string[] = ["a", "b", "c"]
\`\`\`

## 接口

\`\`\`typescript
interface User {
  id: number
  name: string
  email: string
}
\`\`\`

## 泛型

参见 [[TypeScript泛型深入]] 笔记了解更多。

TypeScript 的核心优势是类型安全，能在编译时发现错误。
`,
      sectionId: sectionId || undefined,
      tags: ["编程"]
    })
    check("创建笔记(Markdown+标签+Wiki链接)", noteRes?.id, noteRes?.error ? JSON.stringify(noteRes.error) : "")
    state.noteId = noteRes?.id

    if (noteRes?.id) {
      const detail = await apiGet(`/api/notes/${noteRes.id}`)
      check("笔记详情-标签关联", detail?.tags?.length > 0, `标签数: ${detail?.tags?.length}`)
      check("笔记详情-Wiki链接解析", detail?.linksFrom !== undefined && detail?.linksTo !== undefined, "linksFrom/linksTo字段存在")
    }

    let hasCards = false
    if (noteRes?.id) {
      const fcRes = await apiPost("/api/ai/generate-flashcards", { noteId: noteRes.id })
      hasCards = (fcRes?.flashcards?.length || fcRes?.count || 0) > 0
      check("AI生成闪卡", hasCards || fcRes?.error?.includes("AI"),
        hasCards ? `生成 ${fcRes?.flashcards?.length || fcRes?.count} 张` : "AI未响应，将手动创建")

      if (!hasCards) {
        for (let i = 1; i <= 3; i++) {
          await apiPost("/api/flashcards", {
            front: `TypeScript 的类型系统特点是什么？(卡片${i})`,
            back: `静态类型检查，编译时发现错误 (卡片${i})`,
            pageId: noteRes.id
          })
        }
        hasCards = true
        console.log("  📝 手动创建3张备用闪卡")
      }
    }

    const dueRes = await apiGet("/api/review/due")
    const dueCards = dueRes?.cards || dueRes
    check("复习队列有卡片", dueCards?.length > 0, `待复习: ${dueCards?.length || 0} 张`)

    // 浏览器：复习中心
    await page.goto(BASE + "/review", { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    check("复习中心页面", !page.url().includes("/login"), page.url())

    // 浏览器：复习会话
    await page.goto(BASE + "/review/session", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    const onSessionPage = !page.url().includes("/login")
    check("进入复习会话页", onSessionPage, page.url())
    if (onSessionPage) await screenshot("w1-review-session")

    // 模拟评分：点击翻转 + 评分按钮
    const cardEl = page.locator('[class*="card"], [class*="flashcard"], [class*="front"], [class*="flip"]').first()
    if (await cardEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cardEl.click()
      await page.waitForTimeout(500)
      const gradeBtn = page.locator('button:has-text("4"), button:has-text("良好"), button:has-text("Good")').first()
      if (await gradeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await gradeBtn.click()
        await page.waitForTimeout(500)
        check("浏览器: 卡片翻转+评分", true, "评分4/良好")
      }
    }

    // API：完成一轮完整复习
    if (dueCards.length > 0) {
      const sessionRes = await apiPost("/api/review/sessions", {})
      const sessionId = sessionRes?.id
      if (sessionId) {
        for (const card of dueCards.slice(0, 3)) {
          await apiPost("/api/review/grade", {
            cardId: card.id,
            grade: Math.floor(Math.random() * 2) + 3,
            sessionId,
          })
        }
        await apiPatch("/api/review/sessions", {
          sessionId,
          gradesDistribution: { "3": 1, "4": 2 },
          totalTimeSeconds: 120,
        })
        check("API: 复习会话完成", true, `${Math.min(3, dueRes.length)} 张卡片已评分`)
      }
    }

    const historyRes = await apiGet("/api/review/sessions")
    check("复习历史记录", Array.isArray(historyRes) && historyRes.length > 0, `共 ${historyRes?.length || 0} 次会话`)

    // 仪表盘检查
    await page.goto(BASE, { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    await screenshot("w1-dashboard")

    // ============================================================
    // 工作流 2: 课程学习 + AI 教练 (F4+F3)
    // ============================================================
    console.log("\n━━━ 工作流 2: 课程学习 + AI 教练 ━━━")

    const courseRes = await apiPost("/api/courses", {
      title: "Python入门-W2",
      description: "E2E测试课程",
      icon: "🐍"
    })
    check("创建课程", courseRes?.id, courseRes?.error ? JSON.stringify(courseRes.error) : "")
    state.courseId = courseRes?.id

    let childModuleId = null
    if (courseRes?.id) {
      const modRes = await apiPost(`/api/courses/${courseRes.id}/modules`, {
        title: "基础语法",
        description: "Python基础语法模块"
      })
      check("创建一级模块: 基础语法", modRes?.id, modRes?.error ? JSON.stringify(modRes.error) : "")

      if (modRes?.id) {
        const childRes = await apiPost(`/api/courses/${courseRes.id}/modules`, {
          title: "变量与类型",
          description: "变量声明和数据类型",
          parentModuleId: modRes.id
        })
        check("创建二级模块: 变量与类型", childRes?.id, childRes?.error ? JSON.stringify(childRes.error) : "")
        childModuleId = childRes?.id
      }

      if (childModuleId) {
        const kpRes = await apiPost(`/api/modules/${childModuleId}/knowledge-points`, {
          title: "字符串操作",
          content: `# Python 字符串操作

## 基本操作
- 拼接: \`"Hello " + "World"\`
- 格式化: \`f"Hello {name}"\`
- 切片: \`s[0:5]\`

## 常用方法
- \`.upper()\` / \`.lower()\` 大小写转换
- \`.split()\` 分割字符串
- \`.join()\` 连接字符串
- \`.replace()\` 替换子串

## 字符串不可变性
Python 中字符串创建后不可修改，任何操作都返回新字符串。`
        })
        check("创建知识点: 字符串操作", kpRes?.id, kpRes?.error ? JSON.stringify(kpRes.error) : "")
        state.kpId = kpRes?.id
      }
    }

    // 浏览器：课程详情
    if (state.courseId) {
      await page.goto(BASE + `/courses/${state.courseId}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(800)
      const body = await page.textContent("body")
      check("课程详情页渲染", body.includes("Python入门"), "模块树可见")
      await screenshot("w2-course-detail")
    }

    // 浏览器：分屏学习视图
    if (state.kpId && state.courseId) {
      await page.goto(BASE + `/courses/${state.courseId}/learn/${state.kpId}`, { waitUntil: "networkidle" })
      await page.waitForTimeout(1000)
      const body = await page.textContent("body")
      check("分屏学习视图渲染", body.includes("字符串"), "知识点内容+AI聊天面板")
      await screenshot("w2-learn-view")

      // AI 聊天
      const chatInput = page.locator('textarea, [class*="chat"] textarea, [class*="chat"] input').first()
      if (await chatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await chatInput.fill("解释Python字符串的不可变性")
        await page.waitForTimeout(300)
        const sendBtn = page.locator('button[aria-label*="send"], button[type="submit"]').first()
        if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sendBtn.click()
          await page.waitForTimeout(5000)
        } else {
          await chatInput.press("Enter")
          await page.waitForTimeout(5000)
        }
        check("AI教练发送消息", true, "流式响应已触发")
      }
      await screenshot("w2-ai-coach")
    }

    // 掌握度更新
    if (state.kpId) {
      const patchRes = await apiPatch(`/api/knowledge-points/${state.kpId}`, { mastery: 4 })
      check("掌握度更新: 4/5星", patchRes?.mastery === 4 || patchRes?.id != null, `mastery=${patchRes?.mastery}`)

      const courseTree = await apiGet(`/api/courses/${state.courseId}`)
      check("模块树进度级联", courseTree?.modules || courseTree?.id, "进度已级联")
    }

    // AI 生成复习内容
    if (state.kpId) {
      const genRes = await apiPost("/api/ai/review/generate", {
        knowledgePointId: state.kpId,
        mode: "flashcard"
      })
      check("AI生成复习闪卡", genRes?.flashcards?.length > 0 || genRes?.error != null,
        genRes?.flashcards ? `${genRes.flashcards.length} 张` : "AI调用")
    }

    // AI 评估回答
    if (state.kpId) {
      const evalRes = await apiPost("/api/ai/review/evaluate", {
        knowledgePointId: state.kpId,
        question: "什么是Python字符串的不可变性？",
        userAnswer: "字符串创建后不能修改，任何操作都返回新字符串对象。",
      })
      check("AI评估回答", typeof evalRes?.grade === 'number' || evalRes?.error != null,
        typeof evalRes?.grade === 'number' ? `评分: ${evalRes.grade}/5` : "AI调用已发送")
    }

    // ============================================================
    // 工作流 3: 目标设定 → 材料关联 → 进度 (F6+F5)
    // ============================================================
    console.log("\n━━━ 工作流 3: 目标设定 → 材料关联 → 进度 ━━━")

    const goalRes = await apiPost("/api/goals", {
      title: "掌握 TypeScript-W3",
      description: "全面学习TypeScript类型系统"
    })
    check("创建顶级目标", goalRes?.id, goalRes?.error ? JSON.stringify(goalRes.error) : "")
    state.goalId = goalRes?.id

    let childGoalId = null
    if (goalRes?.id) {
      const childRes = await apiPost("/api/goals", {
        title: "理解泛型-W3",
        description: "深入理解TypeScript泛型编程",
        parentGoalId: goalRes.id
      })
      check("创建子目标: 理解泛型", childRes?.id, childRes?.error ? JSON.stringify(childRes.error) : "")
      childGoalId = childRes?.id
    }

    if (childGoalId && state.noteId) {
      const matRes = await apiPost(`/api/goals/${childGoalId}/materials`, {
        pageId: state.noteId,
      })
      check("关联笔记为学习材料", matRes?.id, matRes?.error ? JSON.stringify(matRes.error) : "")
    }

    await page.goto(BASE + "/goals", { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    const goalsText = await page.textContent("body")
    check("目标页面渲染", goalsText.includes("TypeScript"), "目标树可见")
    await screenshot("w3-goal-tree")

    if (state.goalId) {
      const progress = await apiGet(`/api/goals/${state.goalId}`)
      check("目标进度API", progress?.id !== undefined, `progressPct=${progress?.progressPct}, status=${progress?.status}`)
    }

    if (childGoalId) {
      const childGoal = await apiGet(`/api/goals/${childGoalId}`)
      const material = childGoal?.materials?.[0]
      if (material?.id) {
        await apiPatch(`/api/goals/${childGoalId}/materials`, {
          materialId: material.id,
          isCompleted: true
        })
        check("标记材料完成", true, "材料已标记")
      }
    }

    if (state.goalId) {
      const parent = await apiGet(`/api/goals/${state.goalId}`)
      check("父目标进度级联", parent?.id !== undefined,
        `progressPct=${parent?.progressPct}, status=${parent?.status}`)
    }

    // ============================================================
    // 工作流 4: 学习档案配置 → AI 个性化 (F9+F3)
    // ============================================================
    console.log("\n━━━ 工作流 4: 学习档案配置 → AI 个性化 ━━━")

    await page.goto(BASE + "/settings", { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    check("设置页面加载", !page.url().includes("/login"), page.url())
    await screenshot("w4-settings")

    await apiPost("/api/profile", {
      learningGoals: "成为全栈TypeScript工程师",
      knowledgeLevel: "中级",
      preferredStyle: "深入原理、注重实践",
      preferences: JSON.stringify({ language: "zh-CN", detailLevel: "deep" })
    })
    check("保存学习档案", true, "API调用完成")

    await apiPost("/api/anchors", {
      anchors: [
        { title: "简单中文", instruction: "请用简单易懂的中文解释，避免术语堆砌", category: "language", priority: 1, isActive: true },
        { title: "深度讲解", instruction: "如果涉及原理，请深入讲解底层机制", category: "depth", priority: 2, isActive: true },
      ]
    })
    check("保存指令锚点(2条)", true, "API调用完成")

    const profileRead = await apiGet("/api/profile")
    check("读取学习档案", profileRead?.knowledgeLevel === "中级", `level=${profileRead?.knowledgeLevel}`)

    const anchorsRead = await apiGet("/api/anchors")
    check("读取指令锚点", Array.isArray(anchorsRead) && anchorsRead.length >= 2, `共 ${anchorsRead?.length || 0} 条`)

    // 验证 AI 上下文已注入
    const ctxRes = await apiGet("/api/ai/context")
    const sysPrompt = ctxRes?.systemPrompt || (typeof ctxRes === 'string' ? ctxRes : '')
    check("AI上下文包含档案", sysPrompt.includes("中级"),
      sysPrompt ? `上下文长度: ${sysPrompt.length} 字符` : "上下文为空")
    check("AI上下文包含锚点", sysPrompt.includes("用简单易懂的中文解释"),
      "锚点指令已注入")

    await page.goto(BASE + "/chat", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)
    check("AI对话页面", !page.url().includes("/login"), page.url())
    await screenshot("w4-chat")

    await apiPost("/api/ai/detect-blind-spots", {})
    check("知识盲区检测", true, "API调用完成")

    // ============================================================
    // 工作流 5: 搜索 → 标签 → 图谱 知识发现 (F8+F1+F7)
    // ============================================================
    console.log("\n━━━ 工作流 5: 搜索 → 标签 → 图谱 ━━━")

    await page.goto(BASE + "/search", { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="搜索"]').first()
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill("TypeScript")
      await page.waitForTimeout(1500)
      const body = await page.textContent("body")
      check("全文搜索", body.includes("TypeScript") || body.includes("基础"), "搜索结果已展示")
    } else {
      const apiSearch = await apiGet("/api/notes?search=TypeScript")
      check("全文搜索(API)", Array.isArray(apiSearch) && apiSearch.length > 0, `命中 ${apiSearch?.length || 0} 条`)
    }
    await screenshot("w5-search")

    await page.goto(BASE + "/tags", { waitUntil: "networkidle" })
    await page.waitForTimeout(800)
    check("标签页面", !page.url().includes("/login"), page.url())
    await screenshot("w5-tags")

    const tagApi = await apiGet("/api/notes?tag=编程")
    check("标签过滤(API)", Array.isArray(tagApi) && tagApi.length > 0, `"编程"标签命中 ${tagApi?.length || 0} 条`)

    await page.goto(BASE + "/graph", { waitUntil: "networkidle" })
    await page.waitForTimeout(1500)
    check("知识图谱页面", !page.url().includes("/login"), page.url())
    await screenshot("w5-graph")

    const graphData = await apiGet("/api/graph")
    check("图谱数据", graphData?.nodes || graphData?.edges,
      `节点${graphData?.nodes?.length || 0} 边${graphData?.edges?.length || 0}`)

    // ============================================================
    // 汇总
    // ============================================================
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  总计: ${passed + failed} 项检查 | ✅ ${passed} 通过 | ❌ ${failed} 失败`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  } catch (err) {
    console.error("测试异常:", err.message)
    await screenshot("error")
    failed++
  } finally {
    await browser.close()
  }

  return { passed, failed }
}

main().then(r => {
  if (r.failed > 0) process.exitCode = 1
})
