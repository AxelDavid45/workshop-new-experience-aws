import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyResult } from 'aws-lambda'
import { PK_GASTOS, TABLE_NAME, db } from '../shared/db.ts'
import { json } from '../shared/http.ts'

const LIMITE = 200

// GET /gastos (abierto: cualquiera con la URL puede leerlo)
export async function handler(): Promise<APIGatewayProxyResult> {
  const respuesta = await db.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': PK_GASTOS },
      ScanIndexForward: false, // los más recientes primero
      Limit: LIMITE,
    }),
  )

  const gastos = (respuesta.Items ?? []).map(({ id, fecha, monto, descripcion, categoria, origen }) => ({
    id,
    fecha,
    monto,
    descripcion,
    categoria,
    origen,
  }))

  return json(200, { gastos })
}
