// Página de gastos hormiga. JavaScript sin build ni dependencias, para que lo
// leas completo en un par de minutos.
//
// La URL de tu API se exporta desde config.js; no usamos configuración global.

import { API_URL } from './config.js'

const API = API_URL

const ETIQUETAS = {
  cafes: 'Cafés',
  snacks: 'Snacks',
  transporte: 'Transporte',
  suscripciones: 'Suscripciones',
  otros: 'Otros',
}

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })

// Crea un elemento con texto. Nunca usamos innerHTML con datos de la API:
// la descripción la escribe quien tenga tu API key.
function el(tag, texto, clase) {
  const nodo = document.createElement(tag)
  if (texto !== undefined) nodo.textContent = texto
  if (clase) nodo.className = clase
  return nodo
}

async function pedir(ruta, opciones) {
  const res = await fetch(API + ruta, opciones)
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(cuerpo.error || cuerpo.message || 'HTTP ' + res.status)
  return cuerpo
}

async function cargarGastos() {
  const lista = document.getElementById('lista')
  const totales = document.getElementById('totales')
  const granTotal = document.getElementById('gran-total')
  try {
    const { gastos } = await pedir('/gastos')

    lista.replaceChildren()
    if (gastos.length === 0) {
      const fila = el('tr')
      const celda = el('td', 'Todavía no hay gastos. Registra uno desde tu Atajo.')
      celda.colSpan = 4
      fila.append(celda)
      lista.append(fila)
    }
    for (const g of gastos) {
      const fila = el('tr')
      fila.append(
        el('td', fecha.format(new Date(g.fecha))),
        el('td', g.descripcion),
        el('td', ETIQUETAS[g.categoria] || g.categoria),
        el('td', pesos.format(g.monto), 'num'),
      )
      lista.append(fila)
    }

    const suma = {}
    let total = 0
    for (const g of gastos) {
      suma[g.categoria] = (suma[g.categoria] || 0) + g.monto
      total += g.monto
    }
    granTotal.textContent = `${pesos.format(total)} en ${gastos.length} gastos`
    totales.replaceChildren()
    for (const [categoria, monto] of Object.entries(suma).sort((a, b) => b[1] - a[1])) {
      const item = el('li')
      item.append(el('span', ETIQUETAS[categoria] || categoria), el('strong', pesos.format(monto)))
      totales.append(item)
    }
  } catch (err) {
    granTotal.textContent = 'No pude cargar tus gastos: ' + err.message
    lista.replaceChildren()
  }
}

if (!API) {
  document.getElementById('gran-total').textContent = 'Falta config.js. Corre pnpm preparar-pagina.'
} else {
  cargarGastos()
}
