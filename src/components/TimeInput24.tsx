import React from 'react'

interface TimeInput24Props {
  value: string // HH:MM format
  onChange: (value: string) => void
  required?: boolean
  className?: string
  id?: string
}

export default function TimeInput24({ value, onChange, required, className, id }: TimeInput24Props) {
  const [hours, minutes] = value.split(':').map(Number)

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let h = parseInt(e.target.value, 10) || 0
    h = Math.max(0, Math.min(23, h))
    onChange(`${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let m = parseInt(e.target.value, 10) || 0
    m = Math.max(0, Math.min(59, m))
    onChange(`${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        id={id}
        type="number"
        min="0"
        max="23"
        value={String(hours).padStart(2, '0')}
        onChange={handleHourChange}
        required={required}
        className={`${className} w-16 text-center`}
        placeholder="HH"
      />
      <span className="text-lg font-semibold">:</span>
      <input
        type="number"
        min="0"
        max="59"
        value={String(minutes).padStart(2, '0')}
        onChange={handleMinuteChange}
        className={`${className} w-16 text-center`}
        placeholder="MM"
      />
    </div>
  )
}
