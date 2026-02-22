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

/**
 * Converts leave assignments to a CSV string.
 */
export function exportToCsv(soldiers: Soldier[], assignments: LeaveAssignment[]): string {
  const soldierMap = new Map(soldiers.map(s => [s.id, s.name]))
  const header = 'Soldier,Start Date,End Date,Leave Type,Weekend'
  if (assignments.length === 0) return header
  const rows = assignments.map(a => {
    const name = soldierMap.get(a.soldierId) ?? a.soldierId
    return [name, a.startDate, a.endDate, a.leaveType, a.isWeekend ? 'Yes' : 'No'].join(',')
  })
  return [header, ...rows].join('\n')
}

/**
 * Triggers a browser download of a CSV string as a file.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
