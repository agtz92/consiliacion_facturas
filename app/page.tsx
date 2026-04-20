'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LogoutIcon from '@mui/icons-material/Logout'
import TableChartIcon from '@mui/icons-material/TableChart'

// ── Types ──────────────────────────────────────────────────────────────────

interface Pago {
  fecha: string
  monto: number
  referencia: string
  descripcion: string
}

interface Factura {
  id: number
  folio: string
  fecha: string
  empresa: string
  cliente: string
  concepto: string
  total: number
  estatus: 'pendiente' | 'pagada' | 'coincidencia'
  estatus_display: string
  confianza_coincidencia: number | null
  pago: Pago | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function EstatusBadge({
  estatus,
  confianza,
}: {
  estatus: Factura['estatus']
  confianza: number | null
}) {
  const map: Record<Factura['estatus'], { label: string; color: 'success' | 'warning' | 'default' }> = {
    pagada: { label: 'Pagada', color: 'success' },
    coincidencia: { label: 'Por coincidencia', color: 'warning' },
    pendiente: { label: 'Pendiente', color: 'default' },
  }
  const { label, color } = map[estatus]
  const suffix =
    estatus === 'coincidencia' && confianza != null ? ` ${Math.round(confianza * 100)}%` : ''
  return <Chip label={`${label}${suffix}`} color={color} size="small" />
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

// ── Main component ─────────────────────────────────────────────────────────

export default function FacturasPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<string[]>([])
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null)

  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [facturaMsg, setFacturaMsg] = useState('')

  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const [cuenta, setCuenta] = useState('')
  const [movsMsg, setMovsMsg] = useState('')
  const [movsLoading, setMovsLoading] = useState(false)
  const movsRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/empresas')
      .then((r) => r.json())
      .then((d) => {
        const list: string[] = (d.empresas || []).filter(Boolean)
        setEmpresas(list)
        if (list.length === 1) setEmpresa(list[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!empresa) { setSheetsUrl(null); return }
    fetch(`/api/config?empresa=${encodeURIComponent(empresa)}`)
      .then((r) => r.json())
      .then((d) => setSheetsUrl(d.sheets_url || null))
      .catch(() => setSheetsUrl(null))
  }, [empresa])

  const loadFacturas = useCallback(async () => {
    if (!empresa) { setFacturas([]); return }
    setLoadingFacturas(true)
    setFacturaMsg('')
    try {
      const res = await fetch(`/api/list?empresa=${encodeURIComponent(empresa)}&limit=200`)
      const data = await res.json()
      setFacturas(data.facturas || [])
      setFacturaMsg(`${data.count ?? 0} facturas`)
    } catch {
      setFacturaMsg('Error cargando facturas')
    } finally {
      setLoadingFacturas(false)
    }
  }, [empresa])

  useEffect(() => { loadFacturas() }, [loadFacturas])

  async function handleUploadFacturas(e: React.FormEvent) {
    e.preventDefault()
    const file = uploadRef.current?.files?.[0]
    if (!file || !empresa) return
    setUploadLoading(true)
    setUploadMsg('')
    const form = new FormData()
    form.append('file', file)
    form.append('empresa', empresa)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setUploadMsg(`Error: ${data.error}`); return }
      setUploadMsg(
        `Leídas: ${data.leidas} · Nuevas: ${data.nuevas} · Actualizadas: ${data.actualizadas}`,
      )
      if (uploadRef.current) uploadRef.current.value = ''
      loadFacturas()
    } catch {
      setUploadMsg('Error de conexión')
    } finally {
      setUploadLoading(false)
    }
  }

  async function handleUploadMovimientos(e: React.FormEvent) {
    e.preventDefault()
    const file = movsRef.current?.files?.[0]
    if (!file || !empresa) return
    setMovsLoading(true)
    setMovsMsg('')
    const form = new FormData()
    form.append('file', file)
    form.append('empresa', empresa)
    if (cuenta) form.append('cuenta', cuenta)
    try {
      const res = await fetch('/api/movimientos', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setMovsMsg(`Error: ${data.error}`); return }
      const c = data.conciliacion || {}
      setMovsMsg(
        `Movimientos: ${data.movimientos_nuevos} nuevos · Pagadas: ${c.pagadas ?? 0}, Coincidencias: ${c.coincidencias ?? 0}, Pendientes: ${c.pendientes ?? 0}`,
      )
      if (movsRef.current) movsRef.current.value = ''
      loadFacturas()
    } catch {
      setMovsMsg('Error de conexión')
    } finally {
      setMovsLoading(false)
    }
  }

  function handleLogout() {
    document.cookie = 'facturas_session=; Max-Age=0; path=/'
    router.push('/login')
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5">Facturación</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {sheetsUrl && (
            <Tooltip title="Abrir hoja de Google Sheets">
              <Button
                variant="outlined"
                size="small"
                startIcon={<TableChartIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Sheets
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Cerrar sesión">
            <IconButton onClick={handleLogout} size="small">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Empresa selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Empresa</InputLabel>
          <Select
            value={empresa}
            label="Empresa"
            onChange={(e) => setEmpresa(e.target.value)}
          >
            {empresas.map((emp) => (
              <MenuItem key={emp} value={emp}>
                {emp}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <Stack spacing={3}>
        {/* Upload facturas */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Subir facturas (Excel)
          </Typography>
          <Box component="form" onSubmit={handleUploadFacturas}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <input
                ref={uploadRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ paddingTop: 8 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={uploadLoading || !empresa}
                startIcon={uploadLoading ? <CircularProgress size={16} /> : undefined}
              >
                {uploadLoading ? 'Subiendo…' : 'Subir'}
              </Button>
            </Stack>
          </Box>
          {uploadMsg && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {uploadMsg}
            </Alert>
          )}
        </Paper>

        {/* Upload movimientos */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Subir movimientos bancarios
          </Typography>
          <Box component="form" onSubmit={handleUploadMovimientos}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <input
                  ref={movsRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  style={{ paddingTop: 8 }}
                />
                <TextField
                  label="No. de cuenta (opcional)"
                  size="small"
                  value={cuenta}
                  onChange={(e) => setCuenta(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={movsLoading || !empresa}
                  startIcon={movsLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {movsLoading ? 'Procesando…' : 'Subir y conciliar'}
                </Button>
              </Stack>
            </Stack>
          </Box>
          {movsMsg && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {movsMsg}
            </Alert>
          )}
        </Paper>

        {/* Tabla de facturas */}
        <Paper sx={{ p: 3 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Facturas</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {facturaMsg && (
                <Typography variant="body2" color="text.secondary">
                  {facturaMsg}
                </Typography>
              )}
              <Button
                size="small"
                onClick={loadFacturas}
                disabled={loadingFacturas || !empresa}
              >
                Actualizar
              </Button>
            </Stack>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {loadingFacturas ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : facturas.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              {empresa
                ? 'Sin facturas registradas.'
                : 'Selecciona una empresa para ver facturas.'}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Folio</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Concepto</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Estatus</TableCell>
                    <TableCell>Pago</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {facturas.map((f) => (
                    <TableRow key={f.id} hover>
                      <TableCell>{f.folio}</TableCell>
                      <TableCell>{f.fecha}</TableCell>
                      <TableCell>{f.cliente}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.concepto}
                      </TableCell>
                      <TableCell align="right">{fmt(f.total)}</TableCell>
                      <TableCell>
                        <EstatusBadge
                          estatus={f.estatus}
                          confianza={f.confianza_coincidencia}
                        />
                      </TableCell>
                      <TableCell>
                        {f.pago && (
                          <Typography variant="caption" color="text.secondary">
                            {f.pago.fecha} · {fmt(f.pago.monto)}
                            {f.pago.referencia && ` · ${f.pago.referencia}`}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Stack>
    </Container>
  )
}
