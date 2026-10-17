import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { error } from '../shared/http.ts'

// POST /gastos (requiere API key; API Gateway la revisa antes de llegar aquí)
//
// Todavía no hace nada. Lo escribe Kiro con la tarea 1 de la spec
// (.kiro/specs/gastos-hormiga/tasks.md), y mientras tanto responde 501.
//
// Lo que tiene que hacer:
//   1. Validar el body con validarGasto() de ../shared/validacion.ts.
//   2. Si no es válido, responder 400 con el motivo.
//   3. Guardar el gasto en GastosTable con un PutCommand.
//   4. Responder 201 con el gasto guardado.
export async function handler(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return error(501, 'POST /gastos todavía no está implementado (tarea 1 de la spec)')
}
