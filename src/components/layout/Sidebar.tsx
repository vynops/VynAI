'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Server, Brain, Shield, BarChart3, Settings,
  ChevronLeft, ChevronRight, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/servers', label: 'Servers', icon: Server },
  { href: '/models', label: 'Models', icon: Brain },
  { href: '/gateway', label: 'Gateway', icon: Shield },
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
  const { data: servers = [] } = useSWR<{ id: string }[]>('/api/servers', fetcher, { refreshInterval: 30000 })

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
            <span className="text-xs text-cyan-400 font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded">v0.1</span>
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

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center h-10 border-t border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
