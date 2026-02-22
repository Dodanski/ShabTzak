import type { Toast } from '../hooks/useToast'

interface ToastListProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const TYPE_CLASSES = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
}

export default function ToastList({ toasts, onRemove }: ToastListProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${TYPE_CLASSES[t.type]}`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            aria-label="Dismiss"
            className="ml-2 opacity-75 hover:opacity-100 font-bold"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
