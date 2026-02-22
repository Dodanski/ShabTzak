import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import ErrorBanner from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorBanner error={null} onRetry={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows error message when error is set', () => {
    render(<ErrorBanner error={new Error('Sheet not found')} onRetry={vi.fn()} />)
    expect(screen.getByText(/sheet not found/i)).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner error={new Error('Network error')} onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows a dismiss button', () => {
    render(<ErrorBanner error={new Error('Some error')} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('hides banner after dismiss is clicked', async () => {
    render(<ErrorBanner error={new Error('Some error')} onRetry={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/some error/i)).not.toBeInTheDocument()
  })
})
