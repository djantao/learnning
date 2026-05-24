// 模块综合测验 prompt 生成

export function quizGenPrompt(params: {
  moduleTitle: string
  courseTitle: string
  kpContents: { id: string; title: string; content: string }[]
}): string {
  const { moduleTitle, courseTitle, kpContents } = params

  const domainGuard = `【领域铁律】为课程「${courseTitle}」→ 模块「${moduleTitle}」出综合测验。所有题目必须属于「${courseTitle}」领域。`

  const kpText = kpContents
    .map((kp, i) => `知识点${i + 1}：${kp.title}\n内容：${kp.content.slice(0, 500)}`)
    .join("\n\n")

  return `${domainGuard}

你是严格的出题老师。请为模块「${moduleTitle}」设计综合测验，覆盖以下所有知识点。

${kpText}

## 出题要求

每个知识点出 **2 道题**：1 道选择题 + 1 道简答题。

### 选择题规则
- 4 个选项，只有 1 个正确答案
- 考察概念理解和场景判断，不要纯记忆题
- 干扰项要有迷惑性但不过于明显

### 简答题规则
- 考察深度理解，需要解释原理或分析场景
- 不是单纯复述定义

## 输出格式

严格按以下 JSON 格式输出，不要输出任何其他内容：

{
  "questions": [
    {
      "id": "q1",
      "kpId": "${kpContents[0]?.id || ""}",
      "kpTitle": "知识点名称",
      "type": "choice",
      "content": "题目内容",
      "options": ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"]
    },
    {
      "id": "q2",
      "kpId": "${kpContents[0]?.id || ""}",
      "kpTitle": "知识点名称",
      "type": "short_answer",
      "content": "简答题内容"
    }
  ]
}

题目总数必须是 ${kpContents.length * 2} 道，每个知识点各 1 道选择 + 1 道简答。`
}

export function quizEvalPrompt(params: {
  moduleTitle: string
  courseTitle: string
  questions: { id: string; kpId: string; kpTitle: string; type: string; content: string; options?: string[] }[]
  answers: { qId: string; answer: string }[]
}): string {
  const { moduleTitle, courseTitle, questions, answers } = params

  const qaText = questions
    .map((q) => {
      const ans = answers.find((a) => a.qId === q.id)
      const opts = q.options ? `\n选项：${q.options.join(" / ")}` : ""
      return `【${q.kpTitle}】${q.type === "choice" ? "[选择题]" : "[简答题]"}\n题目：${q.content}${opts}\n学生答案：${ans?.answer || "(未作答)"}`
    })
    .join("\n\n")

  const kpCount = new Set(questions.map((q) => q.kpId)).size
  const qCount = questions.length

  return `你是严格的评卷老师。请批改以下「${courseTitle}」→「${moduleTitle}」模块测验。

${qaText}

## 评分要求

1. 逐题判断对错，给出正确答案和解析
2. 按知识点聚合表现，判定该知识点的掌握等级：
   - 掌握：选择题全对 且 简答题答到要点
   - 熟练：选择题全对 但 简答不完整
   - 薄弱：选择题错了 或 简答完全偏题

## 输出格式

严格按以下 JSON 格式输出：

{
  "overall": "对模块整体掌握情况的2-3句话评价",
  "totalKps": ${kpCount},
  "strong": [{"kpId": "id", "kpTitle": "名称", "reason": "简短原因"}],
  "medium": [{"kpId": "id", "kpTitle": "名称", "reason": "简短原因"}],
  "weak": [{"kpId": "id", "kpTitle": "名称", "reason": "简短原因", "suggestion": "建议回补方向"}],
  "details": [
    {"qId": "q1", "isCorrect": true, "correctAnswer": "正确答案", "explanation": "解析"}
  ]
}

strong/medium/weak 数组中的 kpId 必须与输入的 kpId 一致。details 长度必须等于题目总数(${qCount})。`
}
