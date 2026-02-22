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

  it('applies success background class for success toasts', () => {
    render(<ToastList toasts={[TOASTS[0]]} onRemove={vi.fn()} />)
    const toast = screen.getByText('Soldier discharged').closest('div')
    expect(toast?.className).toContain('bg-green-600')
  })

  it('applies error background class for error toasts', () => {
    render(<ToastList toasts={[TOASTS[1]]} onRemove={vi.fn()} />)
    const toast = screen.getByText('Failed to load').closest('div')
    expect(toast?.className).toContain('bg-red-600')
  })

  it('applies info background class for info toasts', () => {
    const infoToast: Toast = { id: 't3', message: 'Info message', type: 'info' }
    render(<ToastList toasts={[infoToast]} onRemove={vi.fn()} />)
    const toast = screen.getByText('Info message').closest('div')
    expect(toast?.className).toContain('bg-blue-600')
  })

  it('renders a dismiss button for each toast', () => {
    render(<ToastList toasts={TOASTS} onRemove={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /dismiss/i })).toHaveLength(2)
  })
})
