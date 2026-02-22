import type { Soldier, LeaveAssignment } from '../models'

/**
 * Formats leave assignments as human-readable text suitable for WhatsApp sharing.
 */
export function formatScheduleAsText(
  assignments: LeaveAssignment[],
  soldiers: Soldier[],
): string {
  if (assignments.length === 0) {
    return 'No leave assignments scheduled.'
  }

  const soldierMap = new Map(soldiers.map(s => [s.id, s.name]))

  const lines = assignments.map(a => {
    const name = soldierMap.get(a.soldierId) ?? a.soldierId
    const range = a.startDate === a.endDate
      ? a.startDate
      : `${a.startDate} – ${a.endDate}`
    return `${name}: ${range} (${a.leaveType})`
  })

  return `Leave Schedule\n--------------\n${lines.join('\n')}`
}

/**
 * Triggers the browser's print dialog (print-to-PDF).
 */
export function exportToPdf(): void {
  window.print()
}
