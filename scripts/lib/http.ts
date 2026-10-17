// Llamadas HTTP a la API desplegada de cada quien, para los checkpoints.

export interface Respuesta {
  status: number
  headers: Headers
  texto: string
  json: any
}

export async function pedir(
  url: string,
  opciones: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<Respuesta> {
  const res = await fetch(url, {
    method: opciones.method ?? 'GET',
    headers: {
      ...(opciones.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...opciones.headers,
    },
    body: opciones.body === undefined ? undefined : typeof opciones.body === 'string' ? opciones.body : JSON.stringify(opciones.body),
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await res.text()
  let json: any = null
  try {
    json = JSON.parse(texto)
  } catch {
    // no era JSON (HTML de CloudFront, por ejemplo)
  }
  return { status: res.status, headers: res.headers, texto, json }
}
