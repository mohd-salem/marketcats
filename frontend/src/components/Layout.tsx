import { Outlet, NavLink } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'

function MarketCatsLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#logoGrad)" />
      <path d="M16 42 L16 26 L24 36 L32 26 L32 42" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M48 30 Q48 24 42 24 Q36 24 36 32 Q36 40 42 40 Q48 40 48 34" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-brand-700">
          <MarketCatsLogo />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-white">MarketCats</span>
            <span className="text-[10px] text-brand-300 font-medium tracking-wide uppercase">AI Categorization</span>
          </div>
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
        <div className="px-5 py-4 text-[10px] text-brand-400 border-t border-brand-700 tracking-wide">
          Powered by Claude AI
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
