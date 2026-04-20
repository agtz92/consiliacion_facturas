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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditNoteIcon from '@mui/icons-material/EditNote'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

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
  override_manual: boolean
  comentario_override: string
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

// ── Override dialog ────────────────────────────────────────────────────────

function OverrideDialog({
  factura,
  onClose,
  onSaved,
}: {
  factura: Factura | null
  onClose: () => void
  onSaved: (updated: Factura) => void
}) {
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (factura) setComentario(factura.comentario_override || '')
  }, [factura])

  if (!factura) return null

  const isOverridden = factura.override_manual

  async function handleSave() {
    setLoading(true)
    const res = await fetch('/api/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factura_id: factura!.id, comentario }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { onSaved(data.factura); onClose() }
  }

  async function handlePendiente() {
    setLoading(true)
    const res = await fetch('/api/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factura_id: factura!.id, estatus: 'pendiente' }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { onSaved(data.factura); onClose() }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleIcon color="success" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {isOverridden ? 'Editar pago manual' : 'Marcar como pagada'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {factura.folio} · {factura.cliente} · {fmt(factura.total)}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Comentario (referencia, banco, fecha de pago…)"
          multiline
          rows={3}
          fullWidth
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {factura.estatus !== 'pendiente' && (
            <Button color="warning" onClick={handlePendiente} disabled={loading}>
              Marcar pendiente
            </Button>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={loading || !comentario.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {isOverridden ? 'Guardar' : 'Marcar pagada'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

// ── Pendientes summary ─────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'fresh',  label: 'Recientes',  days: [0, 4],   color: '#1976d2', bg: '#e3f2fd' },
  { key: 'warn5',  label: '+5 días',    days: [5, 9],   color: '#f57c00', bg: '#fff3e0' },
  { key: 'warn10', label: '+10 días',   days: [10, 14], color: '#e65100', bg: '#fbe9e7' },
  { key: 'warn15', label: '+15 días',   days: [15, Infinity], color: '#c62828', bg: '#ffebee' },
] as const

function daysSince(fechaStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = fechaStr.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return Math.floor((today.getTime() - fecha.getTime()) / 86_400_000)
}

function PendientesSummary({ facturas }: { facturas: Factura[] }) {
  const pendientes = facturas.filter((f) => f.estatus === 'pendiente')
  if (pendientes.length === 0) return null

  const totalMonto = pendientes.reduce((s, f) => s + f.total, 0)

  const groups = BUCKETS.map((b) => ({
    ...b,
    items: pendientes.filter((f) => {
      const d = daysSince(f.fecha)
      return d >= b.days[0] && d <= b.days[1]
    }),
  })).filter((g) => g.items.length > 0)

  const worst = groups[groups.length - 1]

  return (
    <Accordion
      disableGutters
      defaultExpanded
      sx={{
        border: `2px solid ${worst.color}`,
        borderRadius: 2,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: worst.color }} />}
        sx={{ bgcolor: worst.bg, borderRadius: 1 }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 1 }}>
          <WarningAmberIcon sx={{ color: worst.color }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ color: worst.color, fontWeight: 700 }}>
              {pendientes.length} factura{pendientes.length !== 1 ? 's' : ''} pendiente
              {pendientes.length !== 1 ? 's' : ''} · {fmt(totalMonto)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={100}
              sx={{
                mt: 0.5,
                height: 4,
                borderRadius: 2,
                bgcolor: `${worst.color}22`,
                '& .MuiLinearProgress-bar': { bgcolor: worst.color },
              }}
            />
          </Box>
          <Stack direction="row" spacing={1}>
            {groups.map((g) => (
              <Chip
                key={g.key}
                label={`${g.label} (${g.items.length})`}
                size="small"
                sx={{ bgcolor: g.bg, color: g.color, fontWeight: 600, border: `1px solid ${g.color}` }}
              />
            ))}
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ bgcolor: '#fafafa', p: 2 }}>
        <Stack spacing={2}>
          {groups.map((g) => (
            <Box key={g.key}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: g.color }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: g.color }}>
                  {g.label} — {g.items.length} factura{g.items.length !== 1 ? 's' : ''} · {fmt(g.items.reduce((s, f) => s + f.total, 0))}
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {g.items.map((f) => (
                  <Tooltip
                    key={f.id}
                    title={`${f.cliente} · ${fmt(f.total)} · ${daysSince(f.fecha)} días`}
                  >
                    <Chip
                      label={`${f.folio} · ${fmt(f.total)}`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: g.color, color: g.color }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function FacturasPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<string[]>([])
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null)
  const [mes, setMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

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

  const [overrideFactura, setOverrideFactura] = useState<Factura | null>(null)

  function handleOverrideSaved(updated: Factura) {
    setFacturas((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }

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
      const params = new URLSearchParams({ empresa, limit: '200' })
      if (mes) params.set('mes', mes)
      const res = await fetch(`/api/list?${params}`)
      const data = await res.json()
      setFacturas(data.facturas || [])
      setFacturaMsg(`${data.count ?? 0} facturas`)
    } catch {
      setFacturaMsg('Error cargando facturas')
    } finally {
      setLoadingFacturas(false)
    }
  }, [empresa, mes])

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
      <OverrideDialog
        factura={overrideFactura}
        onClose={() => setOverrideFactura(null)}
        onSaved={handleOverrideSaved}
      />
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

      {/* Reglas de conciliación */}
      <Accordion disableGutters sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">¿Cómo funciona la conciliación?</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Chip label="Pagada" color="success" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2" component="span">
                El monto del movimiento coincide con el total de la factura (tolerancia ±$0.01){' '}
                <strong>y</strong> el folio o alguna palabra del cliente (≥4 letras) aparece en la
                descripción o referencia del movimiento. Ventana de fechas: hasta{' '}
                <strong>3 días antes</strong> y <strong>28 días después</strong> de la fecha de la
                factura.
              </Typography>
            </Box>
            <Box>
              <Chip label="Por coincidencia" color="warning" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2" component="span">
                El monto coincide (±$0.01) pero <strong>no</strong> se identifica el folio ni el
                cliente en el texto del movimiento. Ventana: <strong>±7 días</strong> desde la
                fecha de la factura. La confianza baja con la distancia en días:
              </Typography>
              <Table size="small" sx={{ mt: 1, maxWidth: 320 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Días de diferencia</TableCell>
                    <TableCell align="right">Confianza</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    ['0 días', '100%'],
                    ['1 día', '88%'],
                    ['2 días', '75%'],
                    ['3 días', '63%'],
                    ['4 días', '50%'],
                    ['5 días', '38%'],
                    ['6 – 7 días', '30% (mínimo)'],
                  ].map(([dias, conf]) => (
                    <TableRow key={dias}>
                      <TableCell>{dias}</TableCell>
                      <TableCell align="right">{conf}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box>
              <Chip label="Pendiente" color="default" size="small" sx={{ mr: 1 }} />
              <Typography variant="body2" component="span">
                No se encontró ningún movimiento que coincida en monto y fecha.
              </Typography>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Empresa + Mes */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
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
          <TextField
            label="Mes"
            type="month"
            size="small"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
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

        {/* Resumen de pendientes */}
        <PendientesSummary facturas={facturas} />

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
                    <TableCell />
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
                        {f.pago && !f.override_manual && (
                          <Typography variant="caption" color="text.secondary">
                            {f.pago.fecha} · {fmt(f.pago.monto)}
                            {f.pago.referencia && ` · ${f.pago.referencia}`}
                          </Typography>
                        )}
                        {f.override_manual && (
                          <Typography variant="caption" color="text.secondary">
                            {f.comentario_override}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip
                          title={
                            f.override_manual
                              ? `Pago manual: ${f.comentario_override}`
                              : 'Marcar como pagada manualmente'
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={() => setOverrideFactura(f)}
                            sx={{ color: f.override_manual ? 'success.main' : 'action.disabled' }}
                          >
                            {f.override_manual ? (
                              <CheckCircleIcon fontSize="small" />
                            ) : (
                              <EditNoteIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
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
