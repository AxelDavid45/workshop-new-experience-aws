// Las categorías son fijas en todo el workshop (ver .kiro/specs/gastos-hormiga/design.md).
// El Atajo, la página y la API usan exactamente estos identificadores.

export const CATEGORIAS = ['cafes', 'snacks', 'transporte', 'suscripciones', 'otros'] as const

export type Categoria = (typeof CATEGORIAS)[number]

// Nombre bonito para mostrar en la página.
export const ETIQUETAS: Record<Categoria, string> = {
  cafes: 'Cafés',
  snacks: 'Snacks',
  transporte: 'Transporte',
  suscripciones: 'Suscripciones',
  otros: 'Otros',
}

// El Atajo manda lo que eligiste en el menú ("Cafés", "cafes", " CAFÉS ").
// Quitamos acentos, espacios y mayúsculas antes de comparar.
export function normalizarCategoria(valor: unknown): Categoria | null {
  if (typeof valor !== 'string') return null
  const limpio = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  return (CATEGORIAS as readonly string[]).includes(limpio) ? (limpio as Categoria) : null
}
