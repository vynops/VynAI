import { NextResponse } from 'next/server'
import { listLogs } from '@/lib/request-log-store'

export async function GET() {
  return NextResponse.json(listLogs(500))
}
