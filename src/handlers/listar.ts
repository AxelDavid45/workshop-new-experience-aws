import type { APIGatewayProxyResult } from 'aws-lambda'
import { error } from '../shared/http.ts'

// GET /gastos (abierto: cualquiera con la URL puede leerlo)
//
// Todavía no hace nada. Lo escribe Kiro con la tarea 1 de la spec
// (.kiro/specs/gastos-hormiga/tasks.md), y mientras tanto responde 501.
//
// Lo que tiene que hacer:
//   1. Pedir los gastos a GastosTable con un QueryCommand, nunca un Scan.
//   2. Regresar los más recientes primero, máximo 200.
//   3. Responder 200 con { gastos: [...] }.
export async function handler(): Promise<APIGatewayProxyResult> {
  return error(501, 'GET /gastos todavía no está implementado (tarea 1 de la spec)')
}
