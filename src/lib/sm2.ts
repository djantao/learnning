export interface SM2State {
  interval: number      // Days until next review
  repetitions: number   // Consecutive correct reviews
  efactor: number       // Easiness factor (minimum 1.3)
  nextReview: Date      // When to show this card next
}

export type Grade = 0 | 1 | 2 | 3 | 4 | 5
// 0 = complete blackout
// 1 = incorrect, but remembered upon seeing answer
// 2 = incorrect, but answer seemed easy once seen
// 3 = correct with serious difficulty
// 4 = correct after hesitation
// 5 = perfect response

export function sm2(state: SM2State, grade: Grade, now: Date = new Date()): SM2State {
  let { interval, repetitions, efactor } = state

  if (grade >= 3) {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * efactor)
    }
    repetitions += 1
  } else {
    repetitions = 0
    interval = 1
  }

  efactor = efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  if (efactor < 1.3) efactor = 1.3

  const nextReview = new Date(now)
  nextReview.setDate(nextReview.getDate() + interval)

  return { interval, repetitions, efactor, nextReview }
}

export function isDue(state: SM2State, now: Date = new Date()): boolean {
  return state.nextReview <= now
}
