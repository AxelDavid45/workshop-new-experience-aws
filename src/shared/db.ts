import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// El nombre de la tabla llega como variable de entorno desde template.yaml.
export const TABLE_NAME = process.env.TABLE_NAME ?? 'gastos-hormiga-gastos'

// Se crea una vez por contenedor de Lambda y se reusa entre invocaciones.
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))

// KeySchema de GastosTable (ver la spec en .kiro/specs/gastos-hormiga/design.md).
// No se modifica.
//   pk = "GASTOS"                      sk = "GASTO#<fecha ISO>#<id>"
//   pk = "PRESUPUESTOS"                sk = "CATEGORIA#<categoria>"
// Como la sk empieza con la fecha, un Query con BETWEEN te da los gastos de
// un rango de fechas ya ordenados.
export const PK_GASTOS = 'GASTOS'
export const PK_PRESUPUESTOS = 'PRESUPUESTOS'

export function skGasto(fecha: string, id: string): string {
  return `GASTO#${fecha}#${id}`
}

export function skPresupuesto(categoria: string): string {
  return `CATEGORIA#${categoria}`
}
