'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Server, Brain, Shield, BarChart3, Settings,
  Cpu, LogOut, ScrollText, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/servers', label: 'Servers', icon: Server },
  { href: '/models', label: 'Models', icon: Brain },
  { href: '/gateway', label: 'Gateway', icon: Shield },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

interface Props {
  collapsed: boolean
  mobileOpen: boolean
  onMobileClose: () => void
  onToggleCollapse: () => void
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, onToggleCollapse }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: servers = [] } = useSWR<{ id: string }[]>('/api/servers', fetcher, { refreshInterval: 30000 })
  const { data: me } = useSWR<{ name: string; role: string }>('/api/auth/me', fetcher)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className={cn(
      'fixed lg:relative inset-y-0 left-0 z-30 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 flex-shrink-0',
      collapsed ? 'w-16' : 'w-60',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b border-slate-800 px-4 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between',
      )}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
            <Cpu size={16} className="text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
              <Cpu size={14} className="text-white" />
            </div>
            <span className="font-black text-white text-lg tracking-tight">VynAI</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70',
                collapsed && 'justify-center px-2',
              )}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        <div className="my-3 border-t border-slate-800/60" />

        {me?.role === 'admin' && (
          <Link
            href="/users"
            onClick={onMobileClose}
            title={collapsed ? 'Users' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              pathname === '/users'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70',
              collapsed && 'justify-center px-2',
            )}
          >
            <Users size={18} className="flex-shrink-0" />
            {!collapsed && <span>Users</span>}
          </Link>
        )}

        <Link
          href="/settings"
          onClick={onMobileClose}
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            pathname === '/settings'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70',
            collapsed && 'justify-center px-2',
          )}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </nav>

      {/* Status */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-xs text-slate-500">
              {servers.length === 0 ? 'No servers' : `${servers.length} server${servers.length !== 1 ? 's' : ''} registered`}
            </span>
          </div>
        </div>
      )}

      {/* User + VynOps Suite */}
      <div className="px-3 py-3 border-t border-slate-800/60 shrink-0 space-y-2">
        {me?.name && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400 shrink-0">
              {me.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-white truncate">{me.name}</div>
              <div className="text-[9px] text-slate-500 uppercase font-bold">{me.role}</div>
            </div>
            <button onClick={logout} title="Sign out"
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-600 hover:text-slate-300 transition-colors">
              <LogOut size={12} />
            </button>
          </div>
        )}
        <div className="text-[10px] text-slate-700 px-1">Part of VynOps Suite</div>
      </div>

    </aside>
  )
}
