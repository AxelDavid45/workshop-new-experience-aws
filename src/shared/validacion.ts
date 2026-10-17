import { normalizarCategoria, type Categoria } from './categorias.ts'

export interface GastoNuevo {
  monto: number
  descripcion: string
  categoria: Categoria
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string }

const MONTO_MAXIMO = 100_000

// Valida el body del POST /gastos. Regresa el gasto limpio o el motivo del 400.
export function validarGasto(body: Record<string, unknown> | null): Resultado<GastoNuevo> {
  if (!body) return { ok: false, error: 'El body tiene que ser un JSON con monto, descripcion y categoria' }

  // El Atajo puede mandar el monto como número o como texto ("45.5").
  const monto = typeof body.monto === 'string' ? Number(body.monto) : body.monto
  if (typeof monto !== 'number' || !Number.isFinite(monto)) {
    return { ok: false, error: 'monto tiene que ser un número' }
  }
  if (monto <= 0) {
    return { ok: false, error: 'monto tiene que ser mayor a 0' }
  }
  if (monto > MONTO_MAXIMO) {
    return { ok: false, error: `monto no puede ser mayor a ${MONTO_MAXIMO}` }
  }

  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : ''
  if (descripcion.length === 0 || descripcion.length > 120) {
    return { ok: false, error: 'descripcion tiene que tener entre 1 y 120 caracteres' }
  }

  const categoria = normalizarCategoria(body.categoria)
  if (!categoria) {
    return { ok: false, error: 'categoria tiene que ser cafes, snacks, transporte, suscripciones u otros' }
  }

  return { ok: true, valor: { monto: Math.round(monto * 100) / 100, descripcion, categoria } }
}

// De dónde vino el gasto. Solo guardamos valores conocidos, nunca el header tal cual.
const ORIGENES = ['atajo', 'curl', 'pagina', 'verify'] as const
export type Origen = (typeof ORIGENES)[number] | 'otro'

export function normalizarOrigen(valor: string | undefined): Origen {
  const limpio = (valor ?? '').trim().toLowerCase()
  return (ORIGENES as readonly string[]).includes(limpio) ? (limpio as Origen) : 'otro'
}
