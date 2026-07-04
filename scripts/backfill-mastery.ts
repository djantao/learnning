/**
 * 一次性脚本：回填历史学习数据到 KP mastery
 *
 * 逻辑：
 *   1. 对每个 KP，取最近的 PracticeRecord 和 KpReviewLog
 *   2. 计算加权平均分
 *   3. 如果新值 > 当前 mastery，更新 mastery / status / completedAt
 *   4. 重新计算所属模块和目标的进度
 *   5. 输出变更摘要
 *
 * 用法：npx tsx scripts/backfill-mastery.ts
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaNeonHttp } from "@prisma/adapter-neon"
import "dotenv/config"

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL missing")

  const adapter = new PrismaNeonHttp(dbUrl, {})
  const prisma = new PrismaClient({ adapter })

  console.log("🔄 开始回填 mastery...\n")

  // 获取所有 KP（包含 mastery 和所属用户信息）
  const allKPs = await prisma.knowledgePoint.findMany({
    include: { module: { include: { course: { select: { userId: true } } } } },
  })

  let totalUpdated = 0
  let totalUpgraded = 0
  let totalDowngraded = 0

  for (const kp of allKPs) {
    const userId = kp.module.course.userId
    const kpId = kp.id
    const currentMastery = kp.mastery

    // 获取最近的练习记录（取最近 5 条）
    const practiceRecords = await prisma.practiceRecord.findMany({
      where: { userId, knowledgePointId: kpId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { aiScore: true },
    })

    // 获取最近的复习日志（取最近 5 条）
    const reviewLogs = await prisma.kpReviewLog.findMany({
      where: { userId, knowledgePointId: kpId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { grade: true },
    })

    if (practiceRecords.length === 0 && reviewLogs.length === 0) continue

    // 计算加权平均
    let newMastery = currentMastery

    if (practiceRecords.length > 0) {
      const practiceScores = practiceRecords.map(r => r.aiScore ?? 0).filter(s => s > 0)
      if (practiceScores.length > 0) {
        // 越近的权重越高
        const weights = practiceScores.map((_, i) => 1 - i * 0.15)
        const totalWeight = weights.reduce((s, w) => s + w, 0)
        const weightedAvg = practiceScores.reduce((s, score, i) => s + score * weights[i], 0) / totalWeight
        const practiceMastery = Math.round(Math.min(5, Math.max(1, weightedAvg)))
        newMastery = Math.max(newMastery, practiceMastery)
      }
    }

    if (reviewLogs.length > 0) {
      const reviewGrades = reviewLogs.map(r => r.grade)
      // 越近的权重越高
      const weights = reviewGrades.map((_, i) => 1 - i * 0.15)
      const totalWeight = weights.reduce((s, w) => s + w, 0)
      const weightedAvg = reviewGrades.reduce((s, grade, i) => s + grade * weights[i], 0) / totalWeight
      const reviewMastery = Math.round(Math.min(5, Math.max(1, weightedAvg)))
      newMastery = Math.max(newMastery, reviewMastery)
    }

    if (newMastery !== currentMastery) {
      const direction = newMastery > currentMastery ? "⬆" : "⬇"
      if (newMastery > currentMastery) totalUpgraded++
      else totalDowngraded++

      const newStatus = newMastery >= 4 ? "mastered" : newMastery > 0 ? "in_progress" : "not_started"
      const newCompletedAt = newMastery >= 4 && !kp.completedAt ? new Date() : undefined

      await prisma.knowledgePoint.update({
        where: { id: kpId },
        data: {
          mastery: newMastery,
          status: newStatus,
          ...(newCompletedAt ? { completedAt: newCompletedAt } : {}),
        },
      })

      totalUpdated++
      console.log(
        `  ${direction} KP[${kpId.slice(0, 6)}] "${kp.title}": ${currentMastery} → ${newMastery}` +
        (newStatus === "mastered" ? " ✅" : "")
      )
    }
  }

  console.log(`\n📊 回填完成：`)
  console.log(`  总计更新: ${totalUpdated} 个 KP`)
  console.log(`  提升: ${totalUpgraded} 个`)
  console.log(`  降低: ${totalDowngraded} 个`)
  console.log(`  无变化: ${allKPs.length - totalUpdated} 个`)

  // 重新计算所有模块和目标的进度
  console.log(`\n🔄 重新计算模块和目标进度...`)

  const updatedModules = await prisma.module.findMany({
    include: {
      knowledgePoints: { select: { mastery: true } },
      childModules: { select: { id: true } },
    },
  })

  for (const mod of updatedModules) {
    const masteredKps = mod.knowledgePoints.filter(k => k.mastery >= 4).length
    const totalKps = mod.knowledgePoints.length
    const progressPct = totalKps > 0 ? Math.round((masteredKps / totalKps) * 100) : 0
    const status = progressPct >= 100 ? "completed" : progressPct > 0 ? "in_progress" : "not_started"

    await prisma.module.update({
      where: { id: mod.id },
      data: { progressPct, status },
    })
  }

  console.log(`  ✅ 已更新 ${updatedModules.length} 个模块的进度`)

  // 重新计算目标进度
  const goals = await prisma.learningGoal.findMany({
    where: { courseId: { not: null } },
  })

  for (const goal of goals) {
    if (!goal.courseId) continue
    const course = await prisma.course.findFirst({
      where: { id: goal.courseId },
      include: {
        modules: {
          include: { knowledgePoints: { select: { mastery: true } } },
        },
      },
    })
    if (!course) continue

    const allKps = course.modules.flatMap(m => m.knowledgePoints)
    const masteredKps = allKps.filter(k => k.mastery >= 4).length
    const totalKps = allKps.length
    const progressPct = totalKps > 0 ? Math.round((masteredKps / totalKps) * 100) : 0

    await prisma.learningGoal.update({
      where: { id: goal.id },
      data: {
        progressPct,
        status: progressPct >= 100 ? "completed" : progressPct > 0 ? "in_progress" : "not_started",
      },
    })
  }

  console.log(`  ✅ 已更新 ${goals.length} 个学习目标的进度`)
  console.log(`\n🎉 全部完成！`)

  await prisma.$disconnect()
}

main().catch(e => {
  console.error("❌ 回填失败:", e)
  process.exit(1)
})
