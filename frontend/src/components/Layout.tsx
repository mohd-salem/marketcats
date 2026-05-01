import { Outlet, NavLink } from 'react-router-dom'
import { LayoutGrid, Tag } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-brand-700">
          <Tag className="w-5 h-5 text-brand-100" />
          <span className="text-lg font-bold tracking-tight">MarketCats</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/"
            end
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
        <div className="px-5 py-4 text-xs text-brand-300 border-t border-brand-700">
          Powered by REV
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
