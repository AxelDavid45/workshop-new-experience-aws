import { randomUUID } from 'node:crypto'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PK_GASTOS, TABLE_NAME, db, skGasto } from '../shared/db.ts'
import { error, header, json, leerBody } from '../shared/http.ts'
import { normalizarOrigen, validarGasto } from '../shared/validacion.ts'

// POST /gastos (requiere API key; API Gateway la revisa antes de llegar aquí)
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const resultado = validarGasto(leerBody(event))
  if (!resultado.ok) {
    console.log(JSON.stringify({ evento: 'gasto_rechazado', motivo: resultado.error }))
    return error(400, resultado.error)
  }

  const gasto = {
    id: randomUUID(),
    fecha: new Date().toISOString(),
    origen: normalizarOrigen(header(event, 'x-origen')),
    ...resultado.valor,
  }

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk: PK_GASTOS, sk: skGasto(gasto.fecha, gasto.id), ...gasto },
    }),
  )

  console.log(JSON.stringify({ evento: 'gasto_registrado', categoria: gasto.categoria, origen: gasto.origen }))
  return json(201, gasto)
}
