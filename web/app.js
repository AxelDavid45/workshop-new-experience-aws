// Página sin build: config.js exporta la configuración pública.

import * as config from './config.js'

const API = config.API_URL
const COGNITO_CLIENT_ID = config.COGNITO_CLIENT_ID ?? ''
const COGNITO_DOMAIN = config.COGNITO_DOMAIN ?? ''
const TOKEN_KEY = 'gastos-id-token'
const STATE_KEY = 'gastos-oauth-state'
const VERIFIER_KEY = 'gastos-pkce-verifier'

const ETIQUETAS = {
  cafes: 'Cafés',
  snacks: 'Snacks',
  transporte: 'Transporte',
  suscripciones: 'Suscripciones',
  otros: 'Otros',
}

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' })

// textContent trata los datos de la API como texto, nunca como HTML.
function el(tag, texto, clase) {
  const nodo = document.createElement(tag)
  if (texto !== undefined) nodo.textContent = texto
  if (clase) nodo.className = clase
  return nodo
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function valorAleatorio() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

async function challengePkce(verifier) {
  const bytes = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return base64Url(new Uint8Array(hash))
}

function callbackUrl() {
  // FrontendUrl se configura con la URL de la raíz de Amplify, sin slash final.
  return window.location.origin
}

function configuracionCognitoLista() {
  return Boolean(COGNITO_DOMAIN && COGNITO_CLIENT_ID)
}

async function iniciarSesion() {
  const verifier = valorAleatorio()
  const state = valorAleatorio()
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const login = new URL('/oauth2/authorize', COGNITO_DOMAIN)
  login.searchParams.set('client_id', COGNITO_CLIENT_ID)
  login.searchParams.set('response_type', 'code')
  login.searchParams.set('scope', 'openid email')
  login.searchParams.set('redirect_uri', callbackUrl())
  login.searchParams.set('state', state)
  login.searchParams.set('code_challenge', await challengePkce(verifier))
  login.searchParams.set('code_challenge_method', 'S256')
  window.location.assign(login)
}

async function intercambiarCodigo(code, state) {
  const esperado = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!esperado || esperado !== state || !verifier) throw new Error('No pude verificar el regreso de Cognito. Intenta entrar otra vez.')

  const cuerpo = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: callbackUrl(),
    code_verifier: verifier,
  })
  const res = await fetch(new URL('/oauth2/token', COGNITO_DOMAIN), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  })
  const respuesta = await res.json().catch(() => ({}))
  if (!res.ok || !respuesta.id_token) throw new Error(respuesta.error_description || 'Cognito no devolvió un IdToken')

  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.setItem(TOKEN_KEY, respuesta.id_token)
  history.replaceState({}, document.title, window.location.pathname)
  return respuesta.id_token
}

async function tokenDeCognito() {
  const parametros = new URLSearchParams(window.location.search)
  const error = parametros.get('error')
  if (error) throw new Error(parametros.get('error_description') || error)

  const code = parametros.get('code')
  if (code) return intercambiarCodigo(code, parametros.get('state'))

  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) return token

  await iniciarSesion()
  throw new Error('Redirigiendo a Cognito…')
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
    const token = await tokenDeCognito()
    const { gastos } = await pedir('/gastos', { headers: { Authorization: token } })

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
} else if (!configuracionCognitoLista()) {
  document.getElementById('gran-total').textContent = 'Falta configurar Cognito. Despliega el paso extra y vuelve a correr pnpm preparar-pagina.'
} else {
  cargarGastos()
}
