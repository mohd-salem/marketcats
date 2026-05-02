import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutGrid, Menu, X } from 'lucide-react'

function MarketCatsLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#1e3a8a"/>
      <polygon points="13,10 13,30 26,23" fill="white"/>
      <polygon points="51,10 51,30 38,23" fill="white"/>
      <circle cx="32" cy="39" r="18" fill="white"/>
      <polygon points="16,27 16,14 24,23" fill="#93c5fd"/>
      <polygon points="48,27 48,14 40,23" fill="#93c5fd"/>
      <circle cx="25" cy="37" r="4" fill="#1e3a8a"/>
      <circle cx="39" cy="37" r="4" fill="#1e3a8a"/>
      <circle cx="26.5" cy="35.5" r="1.4" fill="white"/>
      <circle cx="40.5" cy="35.5" r="1.4" fill="white"/>
      <ellipse cx="32" cy="43" rx="2.5" ry="2" fill="#93c5fd"/>
    </svg>
  )
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/"
          end
          onClick={onNav}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-700/60'
            }`
          }
        >
          <LayoutGrid className="w-4 h-4" />
          Projects
        </NavLink>
      </nav>
      <div className="px-5 py-4 text-[10px] text-brand-400 border-t border-brand-700 tracking-wide">
        &copy; {new Date().getFullYear()} RND Team. All rights reserved.
      </div>
    </>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-brand-900 text-white transition-transform duration-200 md:static md:translate-x-0 md:z-auto md:shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-brand-700">
          <MarketCatsLogo size={28} />
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-sm font-bold tracking-tight text-white">MarketCats</span>
            <span className="text-[10px] text-brand-300 font-medium tracking-wide uppercase">AI Categorization</span>
          </div>
          <button
            className="md:hidden text-brand-300 hover:text-white p-1 -mr-1"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <SidebarContent onNav={() => setOpen(false)} />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 bg-brand-900 text-white shrink-0 shadow">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-brand-200 hover:text-white"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <MarketCatsLogo size={24} />
            <span className="text-sm font-bold tracking-tight">MarketCats</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
