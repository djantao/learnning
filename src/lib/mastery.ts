/** mastery 0-5 → 三档标签 — 纯函数，客户端安全 */
export function masteryLabel(mastery: number): { label: string; color: string } {
  if (mastery >= 5) return { label: "掌握", color: "green" }
  if (mastery >= 3) return { label: "熟练", color: "amber" }
  return { label: "薄弱", color: "red" }
}
