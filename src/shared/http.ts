import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// CORS queda abierto para los forks del workshop y datos ficticios; no autentica la API.
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
}

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) }
}

export function error(statusCode: number, mensaje: string): APIGatewayProxyResult {
  return json(statusCode, { error: mensaje })
}

// Regresa el body ya parseado, o null si no es un objeto JSON válido.
export function leerBody(event: APIGatewayProxyEvent): Record<string, unknown> | null {
  if (!event.body) return null
  try {
    const texto = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
    const valor: unknown = JSON.parse(texto)
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

// Los headers llegan con mayúsculas o minúsculas según el cliente.
export function header(event: APIGatewayProxyEvent, nombre: string): string | undefined {
  const buscado = nombre.toLowerCase()
  for (const [clave, valor] of Object.entries(event.headers ?? {})) {
    if (clave.toLowerCase() === buscado && valor) return valor
  }
  return undefined
}
