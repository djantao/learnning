# 模块综合测验 + 薄弱诊断

## Problem Statement

MindForge 现有 KP 级别的 AI 出题+评分能力，但学完一个模块（含多个 KP）后，学习者不知道：这个模块整体掌握得怎么样？哪些知识点真会了、哪些是假掌握？应该回去补哪里？只能凭感觉。

## Evidence

- 用户原话："学了好几章不知道自己到底会没会，心里没底"
- 用户原话："做完测验能知道哪里薄弱"
- 现有 `PracticeRecord` 表只记录单 KP 答题，无法跨 KP 聚合诊断
- 现有 `KnowledgePoint.mastery`（0-5）基于 KP 级评估，但模块级没有综合分

## Proposed Solution

**模块综合测验**：用户学完一个模块所有 KP 后，一键生成一套覆盖该模块所有知识点的混合题型测验。答题完成后 AI 逐题评分，生成薄弱诊断报告——精确到每个 KP 的掌握判定 + 需要回补的薄弱点列表。

## Key Hypothesis

我们相信模块级综合测验 + 逐 KP 薄弱诊断能让学习者准确知道"哪里不会"，从而有针对性地回补。
验证标准：同一个课程中，用过测验的模块 vs 没用过的模块，KP mastery ≥ 4 的比例更高。

## What We're NOT Building

- 证书/认证系统 — 用户明确不要
- 排行榜/社交分享 — v1 不做
- 限时模式/倒计时 — v1 不做
- 课程级结业考试 — could have, not now
- 手动出题/题库管理 — 全部 AI 生成

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 测验完成率 | > 80% | 开始测验 / 提交测验 |
| 薄弱点回补率 | > 50% | 诊断报告中的薄弱 KP 在 7 天内被重新学习或重测 |
| 用户信心 | 定性 | "做完测验后心里有底"的用户反馈 |

## Open Questions

- [ ] 选择题 4 选项够不够？要不要混合多选？
- [ ] 每个 KP 出几道题？（初定 2-3 题/KP）
- [ ] 测验是否限制可做次数？（初定不限，鼓励反复测到掌握）

---

## Users & Context

**Primary User**
- **Who**: 自学者（目前仅此用户本人），虎头蛇尾，需要外部机制把关
- **Current behavior**: 学完 KP 内容后，在 KP 页面点"出题"做练习，逐个 KP 零散评估
- **Trigger**: 模块下所有 KP 都学完了，想验证整体掌握程度
- **Success state**: 看到诊断报告，清楚知道强项弱项，有明确的回补目标

**Job to Be Done**
当我学完一个模块的所有知识点后，我想用一套覆盖全模块的综合测验来检验自己，这样我就能准确知道哪些知识点真会了、哪些需要回去重学。

**Non-Users**
- 培训机构教师（本期不考虑教师角色）
- 求职者需要证书（本期不做认证）

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 模块测验生成 — 递归收集模块下所有 KP，AI 生成混合题型 | 核心价值 |
| Must | AI 评分+薄弱诊断报告 — 逐题判分，按 KP 聚合，指出薄弱点 | 核心价值 |
| Must | 测验结果持久化 — 存储到新 Model，支持历史查看 | 可追溯 |
| Should | 重测对比 — 同一模块多次测验，对比进步 | 验证学习效果 |
| Could | 课程级综合测验 — 递归所有子模块的 KP | 更大范围诊断 |
| Won't | 证书/排行榜/限时 | 用户不要 |

### MVP Scope

1. 模块详情页或课程页 → "模块测验"入口（模块下所有 KP 已生成内容后可用）
2. 点击 → AI 生成 N 道题（N = KP数 × 2，混合单选+简答）
3. 答题界面：可滚动整页展示，提交后 AI 评分
4. 诊断报告：总评 + 每个 KP 的掌握判定（强/中/弱）+ 薄弱 KP 列表 + 建议回补方向

### User Flow

```
模块页 → 点"模块测验" → AI 生成题目(3-5秒) → 答题 → 提交 → AI 评分(3-5秒) → 诊断报告
                                                                              ↓
                                                              薄弱 KP 直接可点进去回补
```

---

## Technical Approach

**Feasibility**: HIGH — 已有 KP 级出题+评分基础设施（`generate-questions`、`evaluate-answers`），只需向上聚合+新 UI。

**Architecture Notes**
- 新增 `ModuleQuiz` 模型存储测验记录（moduleId、questions JSON、answers JSON、results JSON、diagnosis JSON）
- 新 API：`POST /api/modules/[moduleId]/quiz` — 生成测验；`PATCH /api/modules/[moduleId]/quiz/[quizId]` — 提交评分
- 复用 `chatCompletion` + 已有的 prompt 风格（enrich-content-v2 的 domainGuard 模式）
- 测验题型生成 prompt：要求 AI 按 KP 分组出题，每个 KP 1 道选择 + 1 道简答
- 诊断 prompt：逐题评分后按 KP 聚合 → 判定等级 + 薄弱点列表

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AI 出题质量不稳定（题目太浅/太偏） | M | prompt 约束 + Bloom 层级要求 |
| 模块 KP 多时 token 消耗大 | M | KP > 10 时分批生成再合并 |
| Neon HTTP 限制（无事务） | L | 已知问题，用 findMany+逐个 update |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends |
|---|-------|-------------|--------|----------|---------|
| 1 | Schema + Model | ModuleQuiz 模型 + db push | pending | - | - |
| 2 | 测验生成 API | POST /api/modules/[id]/quiz — AI 出题+存储 | pending | - | 1 |
| 3 | 评分诊断 API | PATCH /api/modules/[id]/quiz/[id] — 提交+AI评分+诊断 | pending | - | 2 |
| 4 | 前端测验页 | 题目展示+答题+提交 UI | pending | - | 2 |
| 5 | 诊断报告页 | 模块掌握概览+逐KP诊断+薄弱点回补入口 | pending | - | 3,4 |
| 6 | 模块入口+集成 | 模块/课程页加"模块测验"按钮，学完状态检测 | pending | - | 5 |

### Phase Details

**Phase 1: Schema + Model**
- Goal: 持久化测验记录
- Scope: Prisma 加 ModuleQuiz 模型，db push
- Success: 模型可用，类型检查通过

**Phase 2: 测验生成 API**
- Goal: 给定 moduleId，返回一套混合题型测验
- Scope: 递归收集 KP 内容 → prompt → AI 生成 JSON 题目 → 存 ModuleQuiz
- Success: curl 能拿到题目列表

**Phase 3: 评分诊断 API**
- Goal: 提交答案后返回诊断报告
- Scope: AI 逐题评分 → 按 KP 聚合 → 三级判定+薄弱列表 → 更新 mastery
- Success: curl 提交答案后拿到诊断 JSON

**Phase 4: 前端测验页**
- Goal: 用户能答题
- Scope: 测验页面（单选点击+简答输入），提交按钮
- Success: 能完成整套测验并看到 loading→提交

**Phase 5: 诊断报告页**
- Goal: 用户看懂诊断
- Scope: 总评卡片 + KP 掌握度列表(强/中/弱颜色标记) + 薄弱点可点击回补
- Success: 从诊断报告点薄弱 KP 能跳去学习页

**Phase 6: 入口集成**
- Goal: 用户能找到测验入口
- Scope: 模块/课程页加"模块测验"按钮，全部 KP 内容已生成才亮起
- Success: 正常学习路径中自然发现测验

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 题型混合 | 选择+简答 | 纯选择/纯简答 | 选择检知识覆盖，简答检深度理解 |
| 每 KP 题量 | 2 题 (1选择+1简答) | 3-5题/KP | MVP 保持 token 可控，2题已能区分真会假会 |
| 诊断粒度 | 三级（强/中/弱） | 百分制/五分制 | 比数字直观，比二分精确 |
| 生成方式 | 单次 prompt 全模块 | 按 KP 逐个生成 | 模块 KP ≤ 10 时单次更高效 |

---

## Research Summary

**Market Context**
- Khan Academy 的 5 级掌握度状态机（Attempted→Familiar→Proficient→Mastered）是标杆模式
- freeCodeCamp 每章 20 道选择 + 90% 通过线，fCC 用高门槛认证
- Codecademy 70% 通过线 + 低于则标记"needs review" → 与我们诊断回补理念一致
- 市场趋势：评估嵌入学习流程（非独立考试），掌握度可升可降

**Technical Context**
- 已有：`generate-questions` (KP 级)、`evaluate-answers` (AI 评分)、`PracticeRecord` (存储)、`KnowledgePoint.mastery`
- 可复用：`chatCompletion`、`domainGuard` prompt 模式、`curriculum-chat.tsx` 的 UI 交互
- 关键约束：Neon HTTP 不支持事务，需避免 $transaction 和 updateMany
- 出题 prompt 需指定 Bloom 层级，避免全是记忆型题目

---

*Generated: 2026-05-24*
*Status: DRAFT — ready for plan phase*
