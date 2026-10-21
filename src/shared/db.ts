import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// El nombre de la tabla llega como variable de entorno desde template.yaml.
export const TABLE_NAME = process.env.TABLE_NAME ?? 'gastos-hormiga-gastos'

// Se crea una vez por contenedor de Lambda y se reusa entre invocaciones.
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// KeySchema de GastosTable (ver la spec en .kiro/specs/gastos-hormiga/design.md).
// No se modifica.
//   pk = "GASTOS"                      sk = "GASTO#<fecha ISO>#<id>"
// Como la sk empieza con la fecha, un Query devuelve los gastos ya ordenados.
export const PK_GASTOS = 'GASTOS'

export function skGasto(fecha: string, id: string): string {
  return `GASTO#${fecha}#${id}`
}
