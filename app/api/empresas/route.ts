import { NextResponse } from 'next/server'
import { djangoUrl, authHeader } from '@/lib/proxy'

export async function GET() {
  const res = await fetch(djangoUrl('/facturas/api/empresas'), { headers: authHeader() })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
