import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { error } from '../shared/http.ts'

// La tarea 1 implementa POST /gastos. API Gateway revisa la key antes.
// Mientras tanto, el starter responde 501.
export async function handler(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return error(501, 'POST /gastos todavía no está implementado (tarea 1 de la spec)')
}
