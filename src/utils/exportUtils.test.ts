import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatScheduleAsText, exportToPdf, exportToCsv, downloadCsv } from './exportUtils'
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

describe('exportToCsv', () => {
  it('returns a CSV string with header row', () => {
    const csv = exportToCsv(SOLDIERS, ASSIGNMENTS)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toMatch(/soldier|name/i)
  })

  it('includes soldier name and dates in output', () => {
    const csv = exportToCsv(SOLDIERS, ASSIGNMENTS)
    expect(csv).toContain('David Cohen')
    expect(csv).toContain('2026-03-01')
  })

  it('returns only header when no assignments', () => {
    const csv = exportToCsv(SOLDIERS, [])
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(1)
  })

  it('falls back to soldier id when soldier not found', () => {
    const csv = exportToCsv([], ASSIGNMENTS)
    expect(csv).toContain('s1')
  })
})

describe('downloadCsv', () => {
  it('creates a temporary anchor and triggers click', () => {
    const clickSpy = vi.fn()
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      setAttribute: vi.fn(),
      click: clickSpy,
      style: {},
    } as unknown as HTMLElement)
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(n => n)
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(n => n)

    downloadCsv('test.csv', 'a,b\n1,2')

    expect(clickSpy).toHaveBeenCalledOnce()
    createSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
