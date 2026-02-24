import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import SetupPage from './SetupPage'
import type { AppConfig } from '../models'

const mockConfig: AppConfig = {
  leaveRatioDaysInBase: 10, leaveRatioDaysHome: 4, longLeaveMaxDays: 4,
  weekendDays: ['Friday', 'Saturday'], minBasePresence: 20,
  minBasePresenceByRole: {} as AppConfig['minBasePresenceByRole'],
  maxDrivingHours: 8, defaultRestPeriod: 6, taskTypeRestPeriods: {},
  adminEmails: ['extra@example.com'],
}

describe('SetupPage', () => {
  it('shows access denied when not admin', () => {
    render(
      <SetupPage ds={null} isAdmin={false} configData={null} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/access denied/i)).toBeInTheDocument()
  })

  it('shows initialize button when admin', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={mockConfig} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/initialize/i)).toBeInTheDocument()
  })

  it('shows existing admin emails', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={mockConfig} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText('extra@example.com')).toBeInTheDocument()
  })

  it('shows "no extra admins" when list is empty', () => {
    render(
      <SetupPage ds={null} isAdmin={true} configData={{ ...mockConfig, adminEmails: [] }} spreadsheetId="id" onReload={() => {}} />
    )
    expect(screen.getByText(/no extra admins/i)).toBeInTheDocument()
  })
})
