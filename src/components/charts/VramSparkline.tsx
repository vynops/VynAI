interface Point { pct: number; usedGiB: number }

interface Props {
  data: Point[]
  serverId: string
  gpuIndex: number
  totalGiB: number
}

export default function VramSparkline({ data, serverId, gpuIndex, totalGiB }: Props) {
  const id = `vram-${serverId}-${gpuIndex}`

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-between mt-2 h-5">
        <span className="text-xs text-slate-700 italic">Collecting history…</span>
        <span className="text-xs text-slate-700">0:{String(data.length).padStart(2, '0')} / 60 pts</span>
      </div>
    )
  }

  const W = 300
  const H = 28
  const currentPct = data[data.length - 1].pct
  const color = currentPct >= 90 ? '#f87171' : currentPct >= 75 ? '#fbbf24' : '#06b6d4'

  const pts = data.map((d, i) => {
    const x = (i / (Math.max(data.length - 1, 1))) * W
    const y = H - Math.max((d.pct / 100) * H, 1)
    return { x, y, ...d }
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`

  const minPct = Math.min(...data.map(d => d.pct))
  const maxPct = Math.max(...data.map(d => d.pct))
  const last = pts[pts.length - 1]

  const minutesOfData = Math.round((data.length * 12) / 60)
  const timeLabel = minutesOfData < 1 ? `${data.length * 12}s` : `${minutesOfData}m`

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">VRAM history</span>
        <span className="text-xs text-slate-600">last {timeLabel} · {data.length} pts</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 28 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${id}-grad)`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Current value dot */}
        <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
        {/* Min/max markers (if range is meaningful) */}
        {maxPct - minPct > 5 && (
          <>
            <text x="2" y={H - 2} fontSize="7" fill="#475569">{minPct}%</text>
            <text x="2" y="8" fontSize="7" fill="#475569">{maxPct}%</text>
          </>
        )}
      </svg>
    </div>
  )
}
