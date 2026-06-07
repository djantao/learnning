# 学习项目化（Learning Projects）

## Problem Statement

自学最大的敌人不是"学不会"，是"没人管"——打开 app 不知道今天该干嘛，学完不知道学得怎么样，中断后没有动力捡起来。现有的 learnning 有课程、有复习、有目标，但它们各跑各的，用户感受不到"我在往前走的成就感"。对于"虎头蛇尾"型学习者，系统需要主动推，而不是等人来拉。

## Evidence

- 用户自述："想到了就学，没想到就没学"、"学了也没感觉"、"虎头蛇尾"
- Notion 方案被放弃："需要每天自己维护，比较麻烦"
- 市场调研：刚性打卡+多工具切换是用户放弃的主因；可见进度+低摩擦是留存关键
- 代码现状：Goal / Course / Review / Notes / XP 五个系统各自独立，缺少串联层

## Proposed Solution

不引入"项目管理"新概念（用户：管理学习是啥，不懂），而是在现有系统上**加一个轻量串联层**。核心理念：**打开就知道该干嘛，做完就能看到进步，学完就有产出物**。三个关键场景：①继续学习（从上次断点开始）、②学习输出（一键生成文章/面试自检）、③进度叙事（本周学了什么、进度如何）。

## Key Hypothesis

We believe 把 Goal + Course + Review 打通，加上"打开即继续"的引导，能让"虎头蛇尾"的学习者更容易坚持。
We'll know we're right when 用户连续两周有学习记录（不再是"想到了才学"），且至少产出一篇文章。

## What We're NOT Building

- 甘特图 / 燃尽图 / 工期估算 — 这是个人学习，不是工程项目
- 多人协作 / 社交功能 — v1 只服务自己
- 自动排期 — 不做"每天必须学 30 分钟"的刚性打卡，只做"继续上次"的柔性引导
- 学习时长统计仪表盘 — 不做数据炫技，数字要对用户有意义

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 周活跃天数 | ≥3 天/周 | DailyActivity 表 |
| 断点续学率 | >60%（打开后点了"继续"） | 前端埋点 |
| 文章产出 | ≥1 篇/完成模块 | notes 表（source=learning_output） |
| 目标达成 | 30 天内至少完成 1 个目标 | LearningGoal.status=completed |

## Open Questions

- [ ] 用户是否会真的点"生成文章"？还是需要更轻的输出方式（比如一句话总结）？
- [ ] "进度叙事"用 AI 生成摘要还是纯数据展示？成本和延迟如何？
- [ ] goal 和 course 的关系：一个 goal 对多个 course？还是一对一？

---

## Users & Context

**Primary User**
- **Who**: 自学开发者，拖拉型人格（虎头蛇尾），有学习意愿但缺乏持续动力
- **Current behavior**: 想到了打开学一会，没想到几天不打开；学完没有实感
- **Trigger**: "有空了想学点东西"——但打开后需要系统告诉他从哪继续
- **Success state**: 打开 app → 看到"上次学到哪了"→ 点一下继续 → 学完有产出物（文章/通过面试题）

**Job to Be Done**
When 我有 15-30 分钟空闲想学习, I want to 快速进入上次的学习状态并知道今天能完成什么, so I can 感觉自己在持续进步而不是原地打转.

**Non-Users**
- 团队培训管理者 — 这是个人学习工具
- 需要严格考勤/打卡的学习场景 — 不做刚性约束

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 首页「继续学习」卡片 — 显示上次学习的知识点+进度，一键跳转 | 解决"打开不知道干嘛" |
| Must | Goal ↔ Course 关联 — 创建目标时可选关联课程，自动同步进度 | 不用手动维护，自动有"项目感" |
| Must | 模块完成后引导输出 — "学完了！要不要写篇文章总结？" | 解决"学完没感觉" |
| Should | AI 生成文章草稿 — 基于学习内容+用户笔记，生成文章大纲 | 降低输出门槛 |
| Should | 面试自检 — 学完模块后自动生成 3-5 道面试题+参考答案 | 解决"不知道学得怎么样" |
| Should | 每周学习小结 — AI 摘要：本周学了啥、进度如何、建议下周学啥 | 进度叙事，不只看数字 |
| Could | 学习断点提醒 — 超过 2 天没学，系统提醒"继续学习" | 柔性推，不惩罚 |
| Won't | 甘特图、工期、依赖关系、团队协作 | 个人学习不需要 |

### MVP Scope

1. 首页改版：顶部「继续学习」卡片（最近学习知识点 + 进度 + 一键跳转）
2. Goal 关联 Course：创建 goal 时可选 course，自动用课程进度推算 goal.progressPct
3. 模块完成页：学完最后一个 KP 后弹出"输出引导"——写文章 或 面试自检

### User Flow

```
打开首页 → 看到「继续学习：Apache Doris - FE 查询解析（进度 60%）」
         → 点击 → 进入课程学习页
         → 学完最后一个知识点 → 弹出"模块完成！"
         → 选择「写文章」→ AI 生成文章草稿
         → 或者选择「自检」→ 回答 3 道面试题
         → 首页进度更新 → 推荐下一个模块
```

---

## Technical Approach

**Feasibility**: HIGH — 所有数据已有，主要是串联和 UI 改造

**Architecture Notes**
- Goal ↔ Course 关联：在 `LearningGoal` 表加 `courseId?` 字段，`computeGoalProgress` 优先读课程进度
- 「继续学习」状态：利用现有 `KnowledgePoint.firstOpenedAt` + `status` 找到第一个未完成的 KP
- 文章生成：复用现有 `/api/ai/enrich-content` 的 AI 调用模式，新增 `/api/ai/generate-article` 端点
- 面试题：复用现有 `/api/ai/generate-questions` 端点（已存在），调整 prompt 为"面试场景"

**Key Files**
- Prisma: `prisma/schema.prisma` (LearningGoal, Course, Module, KnowledgePoint)
- Goal logic: `src/lib/goals.ts` (computeGoalProgress 需扩展)
- Homepage: `src/app/(main)/page.tsx` (新建，已有框架)
- Course learn page: `src/app/(main)/courses/[courseId]/learn/[kpId]/page.tsx`
- AI enrich: `src/app/api/ai/enrich-content/route.ts` (参考模式)
- Gamification: `src/lib/gamification.ts` (已有成就系统)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AI 文章质量不可控 | M | 先生成大纲让用户确认，再展开全文 |
| Goal 和 Course 进度同步不一致 | L | 每次课程进度变更时重新计算 goal 进度 |
| 面试题与学习内容脱节 | M | Prompt 约束：基于 KP.content 出题 |

---

## Research Summary

**Market Context**
市场上没有产品同时做好"学习机制 + 动机工程 + 项目管理"三个维度。Notion 有 PM 缺学习机制，Anki 有学习机制但零 PM。学习者的核心痛点是：开始容易坚持难，中断后没有动力捡起来。低摩擦（<2分钟/天）+ 可见进度 + 微奖励是最有效的留存组合。

**Technical Context**
learnning 已有完整的基础设施：课程层级（Course→Module→KP）、SM-2复习系统、目标树、XP/成就系统、每日活动统计、提醒系统。只需一个"串联层"将它们打通，不需要引入新的复杂模型。所有必要的数据字段已存在，主要是 UI 改造和少量 API 扩展。

---

*Generated: 2026-05-21*
*Status: DRAFT - needs validation*
