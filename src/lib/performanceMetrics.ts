import type { SupabaseTask } from '@/hooks/useTasks'

export function calculateDailyPerformance(tasks: SupabaseTask[]) {
  const completed = tasks.filter(t => t.status === 'COMPLETED')

  const byDay = completed.reduce<Record<string, number>>((acc, task) => {
    if (!task.closed_at) return acc
    const day = task.closed_at.slice(0, 10) // 'YYYY-MM-DD'
    acc[day] = (acc[day] ?? 0) + 1
    return acc
  }, {})

  const lastClosed = completed
    .filter(t => t.closed_at)
    .sort((a, b) => (b.closed_at! > a.closed_at! ? 1 : -1))[0] ?? null

  return {
    completedCount: completed.length,
    completedByDay: byDay,
    lastClosedAt: lastClosed?.closed_at ?? null,
  }
}

/** Lead time in hours from assigned_at → closed_at */
export function calculateLeadTime(task: SupabaseTask): number | null {
  if (!task.assigned_at || !task.closed_at) return null
  const ms = new Date(task.closed_at).getTime() - new Date(task.assigned_at).getTime()
  return ms / 1000 / 3600
}
