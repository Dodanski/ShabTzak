import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import SchedulePage from './SchedulePage'
import type { Soldier, ScheduleConflict } from '../models'

const SOLDIER: Soldier = {
  id: 's1', name: 'David Cohen', role: 'Driver',
  serviceStart: '2026-01-01', serviceEnd: '2026-12-31',
  initialFairness: 0, currentFairness: 0, status: 'Active',
  hoursWorked: 0, weekendLeavesCount: 0, midweekLeavesCount: 0, afterLeavesCount: 0,
}

const CONFLICT: ScheduleConflict = {
  type: 'NO_ROLE_AVAILABLE',
  message: 'Not enough drivers',
  affectedSoldierIds: [],
  suggestions: ['Add more drivers'],
}

const BASE_PROPS = {
  soldiers: [SOLDIER],
  dates: ['2026-03-01'],
  tasks: [],
  taskAssignments: [],
  leaveAssignments: [],
  conflicts: [],
  onGenerate: vi.fn(),
  onManualAssign: vi.fn(),
}

describe('SchedulePage', () => {
  let writeTextMock: ReturnType<typeof vi.fn>
  let printSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom v24 doesn't include navigator.clipboard — define it manually
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
  })

  afterEach(() => {
    printSpy.mockRestore()
  })

  it('renders heading', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })

  it('renders Generate Schedule button', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeInTheDocument()
  })

  it('calls onGenerate when Generate Schedule clicked', async () => {
    const onGenerate = vi.fn()
    render(<SchedulePage {...BASE_PROPS} onGenerate={onGenerate} />)
    await userEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    expect(onGenerate).toHaveBeenCalledOnce()
  })

  it('renders ScheduleCalendar with soldier name', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByText('David Cohen')).toBeInTheDocument()
  })

  it('renders conflict message when conflicts exist', () => {
    render(<SchedulePage {...BASE_PROPS} conflicts={[CONFLICT]} />)
    expect(screen.getByText('Not enough drivers')).toBeInTheDocument()
  })

  it('shows no conflicts message when there are none', () => {
    render(<SchedulePage {...BASE_PROPS} conflicts={[]} />)
    expect(screen.getByText(/no conflicts/i)).toBeInTheDocument()
  })

  it('renders Copy for WhatsApp button', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /copy for whatsapp/i })).toBeInTheDocument()
  })

  it('calls clipboard.writeText when Copy for WhatsApp clicked', async () => {
    render(<SchedulePage {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /copy for whatsapp/i }))
    expect(writeTextMock).toHaveBeenCalledOnce()
  })

  it('shows Copied! confirmation after WhatsApp copy', async () => {
    render(<SchedulePage {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /copy for whatsapp/i }))
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })

  it('renders Print button', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('calls window.print when Print clicked', async () => {
    render(<SchedulePage {...BASE_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printSpy).toHaveBeenCalledOnce()
  })

  it('renders Export CSV button', () => {
    render(<SchedulePage {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('triggers CSV download when Export CSV clicked', async () => {
    // Render first so React's createElement calls complete before mocking
    render(<SchedulePage {...BASE_PROPS} />)

    const clickSpy = vi.fn()
    const originalCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { setAttribute: vi.fn(), click: clickSpy, style: {} } as unknown as HTMLElement
      }
      return originalCreate(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(n => n)
    vi.spyOn(document.body, 'removeChild').mockImplementation(n => n)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }))
    expect(clickSpy).toHaveBeenCalledOnce()
    createSpy.mockRestore()
  })
})
