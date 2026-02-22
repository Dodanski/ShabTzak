import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './useToast'

describe('useToast', () => {
  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toHaveLength(0)
  })

  it('addToast adds a toast with message and type', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.addToast('Saved!', 'success') })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Saved!')
    expect(result.current.toasts[0].type).toBe('success')
  })

  it('removeToast removes toast by id', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.addToast('Error', 'error') })
    const id = result.current.toasts[0].id
    act(() => { result.current.removeToast(id) })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('multiple toasts can coexist', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addToast('First', 'success')
      result.current.addToast('Second', 'error')
    })
    expect(result.current.toasts).toHaveLength(2)
  })
})
