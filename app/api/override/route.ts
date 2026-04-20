import { NextRequest, NextResponse } from 'next/server'
import { djangoUrl, authHeader } from '@/lib/proxy'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(djangoUrl('/facturas/api/override'), {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
