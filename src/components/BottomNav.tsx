import { useState } from 'react'

export interface NavItem {
  id: string
  label: string
  icon: string
  href?: string
  onClick?: () => void
}

export interface MoreMenuItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BottomNavProps {
  items: NavItem[]
  moreItems?: MoreMenuItem[]
  activeId: string
}

export default function BottomNav({ items, moreItems = [], activeId }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false)

  const handleItemClick = (item: NavItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.href) {
      window.location.hash = item.href
    }
    setShowMore(false)
  }

  const handleMoreItemClick = (item: MoreMenuItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.href) {
      window.location.hash = item.href
    }
    setShowMore(false)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-olive-200 md:hidden z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive = activeId === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] ${
                isActive ? 'text-olive-700' : 'text-olive-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs mt-0.5">{item.label}</span>
            </button>
          )
        })}
        {moreItems.length > 0 && (
          <div className="relative flex-1">
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex flex-col items-center justify-center w-full h-14 min-w-[64px] ${
                showMore ? 'text-olive-700' : 'text-olive-400'
              }`}
            >
              <span className="text-lg">...</span>
              <span className="text-xs mt-0.5">More</span>
            </button>
            {showMore && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMore(false)}
                />
                <div className="absolute bottom-full right-0 mb-2 mr-2 bg-white border border-olive-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                  {moreItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleMoreItemClick(item)}
                      className="block w-full text-left px-4 py-3 text-sm text-olive-700 hover:bg-olive-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
