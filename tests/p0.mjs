import { chromium } from "playwright"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const runId = Date.now().toString(36)

let passed = 0
let failed = 0

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1
    console.log(`  PASS ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`)
  }
}

async function login(browser, email) {
  const context = await browser.newContext({ locale: "zh-CN" })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: "networkidle" })

  if (page.url().includes("/login")) {
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "test")
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
  }

  return { context, page }
}

async function cookieHeader(context) {
  const cookies = await context.cookies()
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

async function api(context, path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(await cookieHeader(context) ? { Cookie: await cookieHeader(context) } : {}),
    ...options.headers,
  }

  const res = await fetch(BASE + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { res, body }
}

async function unauth(path) {
  return fetch(BASE + path, { redirect: "manual" })
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  try {
    console.log("\n=== P0: auth protection ===")
    const protectedApi = await unauth("/api/notes")
    check(
      "unauthenticated API request is protected",
      [307, 308, 401].includes(protectedApi.status),
      `status=${protectedApi.status}`,
    )

    const userA = await login(browser, `p0-a-${runId}@test.dev`)
    check("user A can log in", !userA.page.url().includes("/login"), userA.page.url())

    console.log("\n=== P0: note CRUD ===")
    const notebook = await api(userA.context, "/api/notebooks", {
      method: "POST",
      body: { name: `P0 Notebook ${runId}`, description: "P0 regression notebook" },
    })
    check("create notebook", notebook.res.status === 201 && !!notebook.body?.id, `status=${notebook.res.status}`)

    const section = await api(userA.context, `/api/notebooks/${notebook.body.id}/sections`, {
      method: "POST",
      body: { name: `P0 Section ${runId}` },
    })
    check("create section", section.res.status === 201 && !!section.body?.id, `status=${section.res.status}`)

    const targetTitle = `P0 Target ${runId}`
    const targetNote = await api(userA.context, "/api/notes", {
      method: "POST",
      body: {
        title: targetTitle,
        content: "# Target\n\nThis note is linked by another note.",
        sectionId: section.body.id,
        tags: ["p0", "target"],
      },
    })
    check("create target note", targetNote.res.status === 201 && !!targetNote.body?.id, `status=${targetNote.res.status}`)

    const sourceNote = await api(userA.context, "/api/notes", {
      method: "POST",
      body: {
        title: `P0 Source ${runId}`,
        content: `# Source\n\nThis note links to [[${targetTitle}]] and stores P0 content.`,
        sectionId: section.body.id,
        tags: ["p0", "crud"],
      },
    })
    check("create source note with tags and wikilink", sourceNote.res.status === 201 && !!sourceNote.body?.id, `status=${sourceNote.res.status}`)

    const sourceDetail = await api(userA.context, `/api/notes/${sourceNote.body.id}`)
    check("read note detail", sourceDetail.res.status === 200 && sourceDetail.body?.title === sourceNote.body.title)
    check("note tags are returned", sourceDetail.body?.tags?.length === 2, `tags=${sourceDetail.body?.tags?.length}`)
    check("wikilink creates outgoing link", sourceDetail.body?.linksFrom?.length === 1, `links=${sourceDetail.body?.linksFrom?.length}`)

    const updated = await api(userA.context, `/api/notes/${sourceNote.body.id}`, {
      method: "PUT",
      body: {
        title: `P0 Source Updated ${runId}`,
        content: `# Updated\n\nUpdated P0 content keeps [[${targetTitle}]].`,
        isPinned: true,
      },
    })
    check("update note", updated.res.status === 200 && updated.body?.isPinned === true, `status=${updated.res.status}`)

    const search = await api(userA.context, `/api/notes?search=${encodeURIComponent("Updated P0 content")}`)
    check("search finds updated note", search.res.status === 200 && search.body?.some((note) => note.id === sourceNote.body.id))

    console.log("\n=== P0: flashcard review ===")
    const card = await api(userA.context, "/api/flashcards", {
      method: "POST",
      body: {
        front: `P0 Question ${runId}`,
        back: "P0 Answer",
        pageId: sourceNote.body.id,
        tagsJson: JSON.stringify(["p0"]),
      },
    })
    check("create flashcard", card.res.status === 201 && !!card.body?.id, `status=${card.res.status}`)

    const dueBefore = await api(userA.context, "/api/review/due")
    check("new flashcard is due", dueBefore.body?.cards?.some((dueCard) => dueCard.id === card.body.id))

    const reviewSession = await api(userA.context, "/api/review/sessions", { method: "POST" })
    check("create review session", reviewSession.res.status === 201 && !!reviewSession.body?.id, `status=${reviewSession.res.status}`)

    const graded = await api(userA.context, "/api/review/grade", {
      method: "POST",
      body: {
        cardId: card.body.id,
        sessionId: reviewSession.body.id,
        grade: 5,
        responseTimeMs: 1200,
      },
    })
    check("grade flashcard", graded.res.status === 200 && graded.body?.sm2Repetitions === 1, `status=${graded.res.status}`)
    check("SM-2 schedules next review", graded.body?.sm2Interval === 1 && new Date(graded.body?.sm2NextReview) > new Date())

    const dueAfter = await api(userA.context, "/api/review/due")
    check("graded card is no longer due", !dueAfter.body?.cards?.some((dueCard) => dueCard.id === card.body.id))

    console.log("\n=== P0: data isolation ===")
    const userB = await login(browser, `p0-b-${runId}@test.dev`)
    check("user B can log in", !userB.page.url().includes("/login"), userB.page.url())

    const userBReadA = await api(userB.context, `/api/notes/${sourceNote.body.id}`)
    check("user B cannot read user A note", userBReadA.res.status === 404, `status=${userBReadA.res.status}`)

    const userBCardPatch = await api(userB.context, `/api/flashcards/${card.body.id}`, {
      method: "PATCH",
      body: { front: "tamper" },
    })
    check("user B cannot update user A flashcard", userBCardPatch.res.status === 404, `status=${userBCardPatch.res.status}`)

    const deleted = await api(userA.context, `/api/notes/${sourceNote.body.id}`, { method: "DELETE" })
    check("delete own note", deleted.res.status === 200 && deleted.body?.success === true)

    const afterDelete = await api(userA.context, `/api/notes/${sourceNote.body.id}`)
    check("deleted note returns 404", afterDelete.res.status === 404, `status=${afterDelete.res.status}`)

    await userB.context.close()
    await userA.context.close()
  } catch (error) {
    failed += 1
    console.error("\nP0 test crashed:", error)
  } finally {
    await browser.close()
  }

  console.log(`\nP0 result: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
