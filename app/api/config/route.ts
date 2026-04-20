import { NextRequest, NextResponse } from 'next/server'
import { djangoUrl, authHeader } from '@/lib/proxy'

export async function GET(req: NextRequest) {
  const empresa = req.nextUrl.searchParams.get('empresa') || ''
  const url = djangoUrl(`/facturas/api/config?empresa=${encodeURIComponent(empresa)}`)
  const res = await fetch(url, { headers: authHeader() })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
