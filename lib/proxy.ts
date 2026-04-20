export function djangoUrl(path: string): string {
  const base = (process.env.DJANGO_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
  return `${base}${path}`
}

export function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.FACTURAS_DJANGO_TOKEN || ''}` }
}
