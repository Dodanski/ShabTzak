import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatScheduleAsText, exportToPdf } from './exportUtils'
import type { Soldier, LeaveAssignment } from '../models'

const SOLDIERS: Soldier[] = [
  {
    id: 's1', name: 'David Cohen', role: 'Driver',
    serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
  {
    id: 's2', name: 'Moshe Levi', role: 'Medic',
    serviceStart: '2026-02-01', serviceEnd: '2026-12-31',
    initialFairness: 0, currentFairness: 0, status: 'Active',
    hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
  },
]

const ASSIGNMENTS: LeaveAssignment[] = [
  {
    id: 'la1', soldierId: 's1',
    startDate: '2026-03-01', endDate: '2026-03-03',
    leaveType: 'After', isWeekend: false, isLocked: false,
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'la2', soldierId: 's2',
    startDate: '2026-03-05', endDate: '2026-03-05',
    leaveType: 'Long', isWeekend: true, isLocked: false,
    createdAt: '2026-02-01T00:00:00Z',
  },
]

describe('formatScheduleAsText', () => {
  it('includes soldier name in output', () => {
    const text = formatScheduleAsText(ASSIGNMENTS, SOLDIERS)
    expect(text).toContain('David Cohen')
    expect(text).toContain('Moshe Levi')
  })

  it('includes date range in output', () => {
    const text = formatScheduleAsText(ASSIGNMENTS, SOLDIERS)
    expect(text).toContain('2026-03-01')
    expect(text).toContain('2026-03-03')
  })

  it('returns empty message when no assignments', () => {
    const text = formatScheduleAsText([], SOLDIERS)
    expect(text).toContain('No leave')
  })

  it('falls back to soldier id when soldier not found', () => {
    const text = formatScheduleAsText(ASSIGNMENTS, [])
    expect(text).toContain('s1')
  })
})

describe('exportToPdf', () => {
  let printSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
  })

  afterEach(() => {
    printSpy.mockRestore()
  })

  it('calls window.print()', () => {
    exportToPdf()
    expect(printSpy).toHaveBeenCalledOnce()
  })
})
