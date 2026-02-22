import { useState, useEffect } from 'react'
import type { AppConfig } from '../models'

interface ConfigPageProps {
  config: AppConfig | null
  onSave: (config: AppConfig) => void
  loading: boolean
}

export default function ConfigPage({ config, onSave, loading }: ConfigPageProps) {
  const [form, setForm] = useState<AppConfig | null>(config)

  useEffect(() => {
    setForm(config)
  }, [config])

  if (loading) {
    return <div className="p-4 text-gray-500">Loading configuration…</div>
  }

  if (!form) {
    return <div className="p-4 text-gray-400 text-sm">No configuration found.</div>
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form) onSave(form)
  }

  function setNum(field: keyof AppConfig, value: string) {
    setForm(f => f ? { ...f, [field]: Number(value) } : f)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Configuration</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-lg">
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-base-days">
            Days in base (leave ratio)
          </label>
          <input
            id="cfg-base-days"
            type="number"
            value={form.leaveRatioDaysInBase}
            onChange={e => setNum('leaveRatioDaysInBase', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-home-days">
            Days home (leave ratio)
          </label>
          <input
            id="cfg-home-days"
            type="number"
            value={form.leaveRatioDaysHome}
            onChange={e => setNum('leaveRatioDaysHome', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-long-leave">
            Long leave max days
          </label>
          <input
            id="cfg-long-leave"
            type="number"
            value={form.longLeaveMaxDays}
            onChange={e => setNum('longLeaveMaxDays', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-min-presence">
            Min base presence (%)
          </label>
          <input
            id="cfg-min-presence"
            type="number"
            value={form.minBasePresence}
            onChange={e => setNum('minBasePresence', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={0}
            max={100}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-max-driving">
            Max driving hours
          </label>
          <input
            id="cfg-max-driving"
            type="number"
            value={form.maxDrivingHours}
            onChange={e => setNum('maxDrivingHours', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="cfg-rest">
            Default rest period (hours)
          </label>
          <input
            id="cfg-rest"
            type="number"
            value={form.defaultRestPeriod}
            onChange={e => setNum('defaultRestPeriod', e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Save configuration
        </button>
      </form>
    </div>
  )
}

// Need React for JSX in this file
import React from 'react'
