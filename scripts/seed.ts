import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaNeonHttp } from "@prisma/adapter-neon"
import "dotenv/config"

async function seed() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL missing")

  const adapter = new PrismaNeonHttp(dbUrl, {})
  const prisma = new PrismaClient({ adapter })

  console.log("🌱 开始种子数据...")

  let user = await prisma.user.findUnique({ where: { email: "student@learn.app" } })
  if (!user) {
    user = await prisma.user.create({ data: { email: "student@learn.app", name: "Student" } })
  }
  console.log(`✅ User: ${user.email}`)

  const notebook = await prisma.notebook.create({
    data: { userId: user.id, name: "React 学习笔记", icon: "📘" },
  })
  console.log(`✅ Notebook: ${notebook.name}`)

  const course = await prisma.course.create({
    data: { userId: user.id, title: "React 18 核心概念", description: "从零掌握 React Hooks、状态管理、组件设计" },
  })
  console.log(`✅ Course: ${course.title}`)

  const modules = [
    { title: "React 基础与 JSX", sortOrder: 0 },
    { title: "useState 与状态管理", sortOrder: 1 },
    { title: "useEffect 与副作用", sortOrder: 2 },
  ]
  const createdModules = []
  for (const m of modules) {
    const mod = await prisma.module.create({
      data: { courseId: course.id, title: m.title, sortOrder: m.sortOrder },
    })
    createdModules.push(mod)
    console.log(`  📦 Module: ${mod.title}`)
  }

  const kps = [
    { moduleIdx: 0, title: "JSX 语法基础", sortOrder: 0,
      content: "## JSX 是什么\n\nJSX 是 JavaScript 的语法扩展。\n\n### 核心规则\n1. **单根元素**：每个 JSX 必须有单一根节点\n2. **表达式插值**：用 `{ }` 包裹 JS 表达式\n3. **驼峰命名**：`className` 代替 `class`" },
    { moduleIdx: 0, title: "组件与 Props", sortOrder: 1,
      content: "## 组件化设计\n\nReact 应用由组件组成。\n\n### Props\n- **只读性**：Props 不可变\n- **单向数据流**：父→子\n- 可用 TypeScript 类型检查" },
    { moduleIdx: 1, title: "useState Hook", sortOrder: 0,
      content: "## useState 核心概念\n\n用于函数组件管理状态。\n\n### 要点\n1. `useState(init)` 返回 `[state, setState]`\n2. setState 触发重新渲染\n3. 状态更新是**异步**的" },
    { moduleIdx: 1, title: "状态提升与共享", sortOrder: 1,
      content: "## 状态提升\n\n将 state 移到最近的公共祖先组件。\n\n### 步骤\n1. 找到共享状态的组件\n2. 将 state 移到公共父组件\n3. 通过 props 传递" },
    { moduleIdx: 2, title: "Effect 清理与依赖", sortOrder: 0,
      content: "## useEffect 生命周期\n\n处理副作用：数据获取、订阅、DOM 操作。\n\n### 依赖数组\n- `[]`：仅挂载时\n- `[dep]`：dep 变化时\n- 无数组：每次渲染" },
    { moduleIdx: 2, title: "自定义 Hook", sortOrder: 1,
      content: "## 自定义 Hook\n\n复用状态逻辑。\n\n### 规则\n- 以 `use` 开头\n- 内部可调用其他 Hook" },
  ]

  const createdKps = []
  for (const kp of kps) {
    const record = await prisma.knowledgePoint.create({
      data: {
        moduleId: createdModules[kp.moduleIdx].id,
        title: kp.title, content: kp.content,
        sortOrder: kp.sortOrder, status: "not_started", mastery: 0,
      },
    })
    createdKps.push(record)
    console.log(`    📖 KP: ${record.title}`)
  }

  const conv = await prisma.conversation.create({
    data: {
      userId: user.id, title: "请用一句话总结 JSX",
      courseId: course.id, knowledgePointId: createdKps[0].id, messageCount: 2,
    },
  })
  await prisma.message.create({ data: { conversationId: conv.id, role: "user", content: "请用一句话总结 JSX 的核心概念" } })
  await prisma.message.create({ data: { conversationId: conv.id, role: "assistant", content: "JSX 是 JavaScript 的语法扩展，让你可以在 JS 中以类似 HTML 的方式声明 UI 结构。" } })
  console.log("✅ Conversation + Messages")

  const note = await prisma.page.create({
    data: {
      userId: user.id, sectionId: null,
      title: "JSX 学习笔记",
      slug: "jsx-notes-" + Date.now().toString(36),
      content: "## JSX 核心要点\n1. 必须单根元素\n2. `{ }` 内放表达式\n3. 驼峰命名",
      contentPlain: "JSX 核心要点 单根 表达式 驼峰",
      excerpt: "JSX 核心要点: 单根元素, 表达式插值, 驼峰命名",
      wordCount: 20, knowledgePointId: createdKps[0].id,
    },
  })
  console.log(`✅ Note: ${note.title}`)

  const flashcards = [
    { front: "JSX 中 class 属性应该写什么？", back: "className（驼峰命名）", kpId: createdKps[0].id },
    { front: "useState 返回什么？", back: "[state, setState] 数组", kpId: createdKps[2].id },
    { front: "useEffect 空依赖数组 [] 表示？", back: "只在组件挂载时执行一次", kpId: createdKps[4].id },
    { front: "React 组件命名规则？", back: "必须以大写字母开头", kpId: createdKps[1].id },
    { front: "setState 后 state 立即改变吗？", back: "不会，React 批处理异步更新", kpId: createdKps[2].id },
  ]
  for (const fc of flashcards) {
    await prisma.flashcard.create({
      data: { userId: user.id, front: fc.front, back: fc.back, knowledgePointId: fc.kpId, sourceType: "manual" },
    })
  }
  console.log(`✅ ${flashcards.length} Flashcards`)

  const today = new Date(new Date().toDateString())
  try {
    await prisma.dailyActivity.create({
      data: { userId: user.id, date: today as any, aiConversations: 1, notesCreated: 1, cardsReviewed: 0 },
    })
  } catch {
    // already exists — ignore
  }
  console.log("✅ DailyActivity\n🎉 种子数据完成！")
  await prisma.$disconnect()
}

seed().catch((e) => { console.error(e); process.exit(1) })
