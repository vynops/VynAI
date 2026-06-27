'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Bell, Activity, LogOut } from 'lucide-react'

const TITLES: Record<string, { title: string; sub: string }> = {
  '/overview': { title: 'Overview', sub: 'Fleet health at a glance' },
  '/servers': { title: 'Servers', sub: 'Manage your Ollama server fleet' },
  '/models': { title: 'Models', sub: 'Model inventory and lifecycle' },
  '/gateway': { title: 'API Gateway', sub: 'Keys, routing, and rate limits' },
  '/analytics': { title: 'Analytics', sub: 'Usage, tokens, and latency trends' },
  '/settings': { title: 'Settings', sub: 'Configuration and thresholds' },
}

export default function Header({ onMobileMenuClick }: { onMobileMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const info = TITLES[pathname] ?? { title: 'VynAI', sub: 'Dashboard' }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center px-4 sm:px-6 gap-4 flex-shrink-0">
      <button
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        onClick={onMobileMenuClick}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-white text-base leading-tight truncate">{info.title}</h1>
        <p className="text-xs text-slate-500 truncate hidden sm:block">{info.sub}</p>
      </div>

      {/* Gateway status badge */}
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 flex-shrink-0">
        <Activity size={12} className="text-green-400" />
        <span className="text-xs text-green-400 font-medium">Gateway Online</span>
      </div>

      {/* Alerts bell */}
      <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0" aria-label="Notifications">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}
