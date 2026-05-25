// XP & Level system
export const XP_PER_KP_MASTERED = 50
export const XP_PER_NOTE_CREATED = 5
export const XP_PER_CHAT_MESSAGE = 2

export function xpToLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

export function xpForNextLevel(xp: number) {
  const currentLevel = xpToLevel(xp)
  return currentLevel * currentLevel * 100
}

export function xpProgressInLevel(xp: number) {
  const currentLevel = xpToLevel(xp)
  const prevLevelXp = (currentLevel - 1) * (currentLevel - 1) * 100
  const nextLevelXp = currentLevel * currentLevel * 100
  return ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100
}

export function getLevelTitle(level: number) {
  if (level < 3) return "初学者"
  if (level < 6) return "学习者"
  if (level < 10) return "探索者"
  if (level < 15) return "学者"
  if (level < 22) return "大师"
  return "传奇"
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  condition: (stats: UserStats) => boolean
  icon: string
}

export interface UserStats {
  totalXp: number
  totalKpsMastered: number
  totalNotesCreated: number
  currentStreak: number
  longestStreak: number
  totalStudyMinutes: number
  coursesCompleted: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_kp", name: "迈出第一步", description: "掌握第一个知识点", condition: (s) => s.totalKpsMastered >= 1, icon: "🌟" },
  { id: "five_kps", name: "渐入佳境", description: "掌握 5 个知识点", condition: (s) => s.totalKpsMastered >= 5, icon: "🔥" },
  { id: "twenty_kps", name: "知识积累者", description: "掌握 20 个知识点", condition: (s) => s.totalKpsMastered >= 20, icon: "📚" },
  { id: "streak_3", name: "三日之约", description: "连续学习 3 天", condition: (s) => s.currentStreak >= 3, icon: "📅" },
  { id: "streak_7", name: "一周坚持", description: "连续学习 7 天", condition: (s) => s.currentStreak >= 7, icon: "💪" },
  { id: "streak_30", name: "月度学霸", description: "连续学习 30 天", condition: (s) => s.currentStreak >= 30, icon: "👑" },
  { id: "ten_notes", name: "笔记达人", description: "创建 10 条笔记", condition: (s) => s.totalNotesCreated >= 10, icon: "📝" },
  { id: "level_5", name: "登堂入室", description: "达到等级 5", condition: (s) => xpToLevel(s.totalXp) >= 5, icon: "🎯" },
]

export function checkAchievements(stats: UserStats): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.condition(stats))
}

export function getNewAchievements(before: UserStats, after: UserStats): AchievementDef[] {
  const beforeSet = new Set(checkAchievements(before).map((a) => a.id))
  return checkAchievements(after).filter((a) => !beforeSet.has(a.id))
}

// Celebration message pool
export const CELEBRATION_MESSAGES = [
  "太棒了！🎉", "继续加油！🔥", "你又进步了！💪", "掌握了！🧠",
  "学习使人强大！⭐", "离目标又近了一步！🎯", "你真厉害！👏", "就是这个感觉！✨",
]
