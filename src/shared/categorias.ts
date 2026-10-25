// Identificadores de categoría compartidos por el Atajo, la página y la API.

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

// Acepta acentos, espacios y mayúsculas del menú del Atajo.
export function normalizarCategoria(valor: unknown): Categoria | null {
  if (typeof valor !== 'string') return null
  const limpio = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  return (CATEGORIAS as readonly string[]).includes(limpio) ? (limpio as Categoria) : null
}
