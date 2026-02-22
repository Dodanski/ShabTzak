import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import VersionConflictBanner from './VersionConflictBanner'

describe('VersionConflictBanner', () => {
  it('renders nothing when not stale', () => {
    const { container } = render(<VersionConflictBanner isStale={false} onReload={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders banner when stale', () => {
    render(<VersionConflictBanner isStale={true} onReload={vi.fn()} />)
    expect(screen.getByText(/data has changed/i)).toBeInTheDocument()
  })

  it('shows Reload button when stale', () => {
    render(<VersionConflictBanner isStale={true} onReload={vi.fn()} />)
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('calls onReload when Reload button clicked', async () => {
    const onReload = vi.fn()
    render(<VersionConflictBanner isStale={true} onReload={onReload} />)
    await userEvent.click(screen.getByRole('button', { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
