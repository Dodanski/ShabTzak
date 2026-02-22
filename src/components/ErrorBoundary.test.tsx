import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import ErrorBoundary from './ErrorBoundary'

// Suppress React's error boundary console errors in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Explosion!')
  return <div>Safe</div>
}

// Module-level flag so it can be toggled before the retry click fires
let bombShouldThrow = true
function ControllableBomb() {
  if (bombShouldThrow) throw new Error('Explosion!')
  return <div>Safe</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('shows the error message in fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText(/explosion/i)).toBeInTheDocument()
  })

  it('renders a retry button in fallback UI', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('resets error state when retry is clicked', async () => {
    bombShouldThrow = true
    render(
      <ErrorBoundary>
        <ControllableBomb />
      </ErrorBoundary>
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    bombShouldThrow = false // ensure child won't throw on next render
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(screen.getByText('Safe')).toBeInTheDocument()
  })
})
