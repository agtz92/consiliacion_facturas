import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function makeToken(): string {
  const secret = process.env.FACTURAS_SESSION_SECRET || 'dev-secret'
  return createHmac('sha256', secret).update('facturas-session').digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.password !== process.env.FACTURAS_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('facturas_session', makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}
