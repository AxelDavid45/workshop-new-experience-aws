import type { APIGatewayProxyResult } from 'aws-lambda'
import { error } from '../shared/http.ts'

// La tarea 1 implementa GET /gastos, abierto para quien tenga la URL.
// Mientras tanto, el starter responde 501.
export async function handler(): Promise<APIGatewayProxyResult> {
  return error(501, 'GET /gastos todavía no está implementado (tarea 1 de la spec)')
}
