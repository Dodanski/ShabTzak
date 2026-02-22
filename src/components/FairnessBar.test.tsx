import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import FairnessBar from './FairnessBar'

describe('FairnessBar', () => {
  it('renders the score value', () => {
    render(<FairnessBar score={3.5} average={3.0} />)
    expect(screen.getByText('3.5')).toBeInTheDocument()
  })

  it('has green bar when score is at or below average', () => {
    const { container } = render(<FairnessBar score={2.0} average={3.0} />)
    const bar = container.querySelector('[data-testid="fairness-fill"]')
    expect(bar?.className).toMatch(/green/)
  })

  it('has red bar when score is above average', () => {
    const { container } = render(<FairnessBar score={5.0} average={3.0} />)
    const bar = container.querySelector('[data-testid="fairness-fill"]')
    expect(bar?.className).toMatch(/red/)
  })

  it('renders at 0 score', () => {
    render(<FairnessBar score={0} average={0} />)
    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('fills bar proportionally — does not exceed 100% width', () => {
    const { container } = render(<FairnessBar score={10} average={2} />)
    const bar = container.querySelector('[data-testid="fairness-fill"]') as HTMLElement
    const width = parseInt(bar?.style?.width ?? '0')
    expect(width).toBeLessThanOrEqual(100)
  })
})
