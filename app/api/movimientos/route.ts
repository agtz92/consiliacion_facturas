import { NextRequest, NextResponse } from 'next/server'
import { djangoUrl, authHeader } from '@/lib/proxy'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const res = await fetch(djangoUrl('/facturas/api/movimientos'), {
    method: 'POST',
    headers: authHeader(),
    body: form,
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
