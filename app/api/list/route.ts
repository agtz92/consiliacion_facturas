import { NextRequest, NextResponse } from 'next/server'
import { djangoUrl, authHeader } from '@/lib/proxy'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString()
  const url = djangoUrl(`/facturas/api/list${params ? `?${params}` : ''}`)
  const res = await fetch(url, { headers: authHeader() })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
