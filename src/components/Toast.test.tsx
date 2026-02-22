import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import ToastList from './ToastList'
import type { Toast } from '../hooks/useToast'

const TOASTS: Toast[] = [
  { id: 't1', message: 'Soldier discharged', type: 'success' },
  { id: 't2', message: 'Failed to load', type: 'error' },
]

describe('ToastList', () => {
  it('renders toast messages', () => {
    render(<ToastList toasts={TOASTS} onRemove={vi.fn()} />)
    expect(screen.getByText('Soldier discharged')).toBeInTheDocument()
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastList toasts={[]} onRemove={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onRemove when dismiss button clicked', async () => {
    const onRemove = vi.fn()
    render(<ToastList toasts={[TOASTS[0]]} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onRemove).toHaveBeenCalledWith('t1')
  })
})
