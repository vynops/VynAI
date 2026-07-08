'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Activity, LogOut, AlertCircle } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const TITLES: Record<string, { title: string; sub: string }> = {
  '/overview': { title: 'Overview', sub: 'Fleet health at a glance' },
  '/servers': { title: 'Servers', sub: 'Manage your Ollama server fleet' },
  '/models': { title: 'Models', sub: 'Model inventory and lifecycle' },
  '/gateway': { title: 'API Gateway', sub: 'Keys, routing, and rate limits' },
  '/analytics': { title: 'Analytics', sub: 'Usage, tokens, and latency trends' },
  '/logs': { title: 'Request Logs', sub: 'Gateway request history' },
  '/users': { title: 'Users', sub: 'User management' },
  '/settings': { title: 'Settings', sub: 'Configuration and thresholds' },
}

export default function Header({ onMobileMenuClick }: { onMobileMenuClick: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const info = TITLES[pathname] ?? { title: 'VynAI', sub: 'Dashboard' }

  const { data: overview } = useSWR('/api/overview', fetcher, { refreshInterval: 30000 })
  const serversOnline: number = overview?.stats?.serversOnline ?? 0
  const serversTotal: number = overview?.stats?.serversTotal ?? 0
  const gatewayOnline = serversOnline > 0
  const gatewayLoading = overview === undefined

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

      {/* Gateway status badge — real data from /api/overview */}
      {!gatewayLoading && (
        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border flex-shrink-0 ${
          gatewayOnline
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          {gatewayOnline
            ? <Activity size={12} className="text-green-400" />
            : <AlertCircle size={12} className="text-red-400" />
          }
          <span className={`text-xs font-medium ${gatewayOnline ? 'text-green-400' : 'text-red-400'}`}>
            {gatewayOnline ? `${serversOnline}/${serversTotal} Online` : 'No Servers Online'}
          </span>
        </div>
      )}

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
