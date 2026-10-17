// Página de gastos hormiga. JavaScript sin build ni dependencias, para que lo
// leas completo en un par de minutos.
//
// La URL de tu API la escribe pnpm subir-pagina en config.js.

const API = (window.GASTOS_CONFIG && window.GASTOS_CONFIG.apiUrl) || ''

const ETIQUETAS = {
  cafes: 'Cafés',
  snacks: 'Snacks',
  transporte: 'Transporte',
  suscripciones: 'Suscripciones',
  otros: 'Otros',
}

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })
const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })

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

async function cargarPresupuestos() {
  const contenedor = document.getElementById('presupuestos')
  try {
    const { presupuestos } = await pedir('/presupuestos')
    contenedor.replaceChildren()
    if (presupuestos.length === 0) {
      contenedor.append(el('p', 'Todavía no tienes presupuestos. Crea el primero con el formulario.', 'nota'))
      return
    }
    const lista = el('ul', undefined, 'barras')
    for (const p of presupuestos) {
      const porcentaje = p.tope > 0 ? Math.round((p.gastado / p.tope) * 100) : 0
      const item = el('li')
      const encabezado = el('div', undefined, 'barra-encabezado')
      encabezado.append(
        el('span', `${ETIQUETAS[p.categoria] || p.categoria} · ${p.periodo === 'semana' ? 'a la semana' : 'al mes'}`),
        el('span', `${pesos.format(p.gastado)} de ${pesos.format(p.tope)}`),
      )
      const barra = el('progress')
      barra.max = 100
      barra.value = Math.min(porcentaje, 100)
      barra.setAttribute('aria-label', `${ETIQUETAS[p.categoria] || p.categoria}: ${porcentaje}% del tope`)
      item.append(encabezado, barra, el('p', `${porcentaje}% · se reinicia el ${dia.format(new Date(p.reiniciaEl))}`, 'nota'))
      lista.append(item)
    }
    contenedor.append(lista)
  } catch (err) {
    contenedor.replaceChildren(
      el('p', 'Todavía no hay backend de presupuestos (lo construyes en el módulo 7).', 'nota aviso'),
      el('p', 'Detalle: ' + err.message, 'nota'),
    )
  }
}

document.getElementById('form-presupuesto').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const form = evento.currentTarget
  const estado = document.getElementById('estado-form')
  const datos = new FormData(form)
  const tope = Number(datos.get('tope'))
  if (!Number.isFinite(tope) || tope <= 0) {
    estado.textContent = 'El tope tiene que ser un número mayor a 0.'
    return
  }
  estado.textContent = 'Guardando…'
  try {
    await pedir('/presupuestos/' + encodeURIComponent(datos.get('categoria')), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tope, periodo: datos.get('periodo') }),
    })
    estado.textContent = 'Presupuesto guardado.'
    await cargarPresupuestos()
  } catch (err) {
    estado.textContent = 'No se pudo guardar: ' + err.message + '. ¿Ya existe PUT /presupuestos/{categoria}?'
  }
})

if (!API) {
  document.getElementById('gran-total').textContent = 'Falta config.js. Corre pnpm subir-pagina.'
} else {
  cargarGastos()
  cargarPresupuestos()
}
