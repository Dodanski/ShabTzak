import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

describe('App', () => {
  it('renders ShabTzak title', () => {
    render(<App />)
    expect(screen.getByText('ShabTzak')).toBeInTheDocument()
  })

  it('renders login page with sign-in button when not authenticated', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })
})
