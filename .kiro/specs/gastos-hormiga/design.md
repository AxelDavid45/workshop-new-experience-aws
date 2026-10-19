# Diseño: gastos hormiga

Cómo se construye lo que pide `requirements.md`. Lo que dice este archivo no se negocia, aunque haya otra forma que parezca mejor: los checkpoints del workshop (`pnpm verify N`) y las ramas de solución dependen de estos nombres.

## Infraestructura

- Toda la infraestructura de la app final vive en `template.yaml`, con AWS SAM. La Lambda y la tabla de la práctica manual son efímeras: usan nombres fijos y se borran con `pnpm limpiar-practica` antes del primer deploy.
- Stack `gastos-hormiga` en la Región del proyecto. Los dos salen de `samconfig.toml`.
- Todo recurso que acepte tags lleva `workshop=gastos-hormiga`.
- Runtime fijado en `Globals.Function.Runtime: nodejs24.x`, arquitectura `arm64`.
- Cada Lambda tiene `FunctionName: ${AWS::StackName}-<nombre>` y su `AWS::Logs::LogGroup` con el mismo nombre y `RetentionInDays: 14`, para que `pnpm limpiar` también borre los logs.
- Las Lambdas se empaquetan con esbuild desde `src/` (`Metadata.BuildMethod: esbuild`), en formato ESM, con `@aws-sdk/*` como external porque ya viene en el runtime.

## La tabla de DynamoDB

`GastosTable` no se toca. Estas reglas existen porque un cambio aquí puede borrar tus gastos:

- El logical ID es `GastosTable` en todas las ramas. Si cambia, CloudFormation borra la tabla vieja con tus gastos y crea una vacía.
- `TableName` es fijo: `!Sub ${AWS::StackName}-gastos`. Con nombre propio, CloudFormation no puede hacer un update que reemplace la tabla: el deploy falla y hace rollback en vez de perder los datos en silencio.
- `DeletionPolicy` normal (no `Retain`), para que `pnpm limpiar` borre todo.
- `BillingMode: PAY_PER_REQUEST`.

### KeySchema

Una sola tabla para los gastos de la ruta base y los presupuestos opcionales, con llave compuesta. Este esquema no se modifica.

| Atributo | Tipo | Rol |
|---|---|---|
| `pk` | String | Partition key |
| `sk` | String | Sort key |

| Qué guarda | `pk` | `sk` | Otros atributos |
|---|---|---|---|
| Un gasto | `GASTOS` | `GASTO#<fecha ISO en UTC>#<id>` | `id`, `fecha`, `monto`, `descripcion`, `categoria`, `origen` |
| Un presupuesto | `PRESUPUESTOS` | `CATEGORIA#<categoria>` | `categoria`, `tope`, `periodo`, `actualizado` |

Como la `sk` de los gastos empieza con la fecha, un `Query` con `pk = GASTOS AND sk >= GASTO#<inicio>` regresa los gastos desde una fecha, ya ordenados. Así se calcula lo gastado en un periodo sin `Scan` y sin borrar nada. Los helpers están en `src/shared/db.ts`.

No se agregan índices secundarios (GSI ni LSI).

## API

- Es una REST API (`AWS::Serverless::Api`), no HTTP API: los usage plans y las API keys solo existen en REST.
- Un solo stage: `v1`.
- CORS: `AllowOrigin '*'`, headers `Content-Type,x-api-key,x-origen`, métodos `GET,POST,PUT,OPTIONS`. Las respuestas de las Lambdas incluyen `Access-Control-Allow-Origin: *` (lo hace `src/shared/http.ts`).
- Throttling del stage: 5 peticiones por segundo, ráfaga de 5, para todos los métodos. Va por debajo de las 10 ejecuciones concurrentes de Lambda que trae una cuenta nueva.
- `GastosApiKey` con nombre `${AWS::StackName}-key-${VersionKey}`. Rotar la key es cambiar el parámetro `VersionKey` (`pnpm rotar-key`).
- `GastosUsagePlan`: 2 peticiones por segundo, ráfaga de 4, cuota de 500 al día. Solo limita a quien trae la API key.

| Método y ruta | Auth | Lambda | Permisos de la Lambda |
|---|---|---|---|
| `POST /gastos` | API key | `RegistrarGastoFunction` | `dynamodb:PutItem` sobre `GastosTable` |
| `GET /gastos` | Abierto | `ListarGastosFunction` | `dynamodb:Query` sobre `GastosTable` |
| `PUT /presupuestos/{categoria}` (extra A) | Abierto | `GuardarPresupuestoFunction` | `dynamodb:PutItem` sobre `GastosTable` |
| `GET /presupuestos` (extra A) | Abierto | `ListarPresupuestosFunction` | `dynamodb:Query` sobre `GastosTable` |

Cada Lambda tiene solo los permisos de su fila, escritos como `Statement` explícito. Nada de `DynamoDBCrudPolicy` ni `Resource: '*'`.

Categorías fijas: `cafes`, `snacks`, `transporte`, `suscripciones`, `otros` (`src/shared/categorias.ts`).

## Gastos (tarea 1)

`src/handlers/registrar.ts` y `src/handlers/listar.ts` ya existen como versión vacía que responde 501. La tarea es escribir su cuerpo; el template, los permisos y los helpers ya están listos.

- **Registrar (`POST /gastos`):**
  - lee el body con `leerBody(event)` y lo valida con `validarGasto()` de `src/shared/validacion.ts`;
  - si no es válido, loguea `{"evento":"gasto_rechazado","motivo":...}` y responde `error(400, motivo)`;
  - arma el gasto con `id: randomUUID()`, `fecha: new Date().toISOString()` y `origen: normalizarOrigen(header(event, 'x-origen'))`;
  - lo guarda con un `PutCommand` en `TABLE_NAME`, con `pk: PK_GASTOS` y `sk: skGasto(fecha, id)`;
  - loguea `{"evento":"gasto_registrado","categoria":...,"origen":...}` y responde `json(201, gasto)`, sin `pk` ni `sk`.
- **Listar (`GET /gastos`):**
  - un `QueryCommand` con `KeyConditionExpression: 'pk = :pk'`, `ScanIndexForward: false` y `Limit: 200`, nunca `Scan`;
  - responde `json(200, { gastos })` con solo `id`, `fecha`, `monto`, `descripcion`, `categoria` y `origen` de cada item.
- La validación de montos ≤ 0 en `validacion.ts` no es parte de la tarea: la agrega el asistente a mano después.

## Estilo de los handlers

- Un archivo por handler en `src/handlers/`, que exporta `handler`.
- Lo compartido vive en `src/shared/`: `db.ts` (cliente y llaves), `http.ts` (`json`, `error`, `leerBody`, `header`), `categorias.ts`, `validacion.ts` y `periodo.ts`.
- La validación regresa `{ ok: true, valor }` o `{ ok: false, error }`, y el handler responde 400 con `{ "error": "..." }`.
- Logs en una línea de JSON con un campo `evento` (por ejemplo `{"evento":"gasto_registrado"}`). Nunca se loguea el body completo ni headers.
- Cada handler nuevo lleva su test en `tests/`, con `db.send` reemplazado por un mock (ver `tests/gastos.test.ts`).

## Paso extra A: presupuestos (tarea 3)

- `GuardarPresupuestoFunction` en `src/handlers/guardar-presupuesto.ts`.
- `ListarPresupuestosFunction` en `src/handlers/listar-presupuestos.ts`.
- El periodo se calcula con `inicioDelPeriodo()` y `proximoReinicio()` de `src/shared/periodo.ts`. Ninguna Lambda borra gastos para "reiniciar" un presupuesto.
- Lo gastado se calcula con un `Query` por rango de `sk` y un `FilterExpression` por categoría, paginando con `LastEvaluatedKey`.

## Página (tarea 2)

Los archivos de la página ya existen en `web/` y no cambian. Lo que falta es dónde servirlos, y va en `template.yaml` con estos logical IDs:

- `PaginaBucket` (`AWS::S3::Bucket`), con nombre `${AWS::StackName}-pagina-${AWS::AccountId}`:
  - `PublicAccessBlockConfiguration` con las cuatro opciones en `true`;
  - `OwnershipControls` con `BucketOwnerEnforced`;
  - cifrado `AES256`;
  - sin website hosting (nada de `WebsiteConfiguration`).
- `PaginaOAC` (`AWS::CloudFront::OriginAccessControl`): tipo `s3`, `SigningBehavior: always`, `SigningProtocol: sigv4`.
- `PaginaHeaders` (`AWS::CloudFront::ResponseHeadersPolicy`):
  - header propio `X-Robots-Tag: noindex` con `Override: true`;
  - security headers: `ContentTypeOptions`, `FrameOptions: DENY`, `ReferrerPolicy: no-referrer` y `StrictTransportSecurity`.
- `PaginaDistribucion` (`AWS::CloudFront::Distribution`):
  - origen `PaginaBucket.RegionalDomainName` con `PaginaOAC` y `S3OriginConfig.OriginAccessIdentity: ''`;
  - `DefaultRootObject: index.html`, `ViewerProtocolPolicy: redirect-to-https`, solo `GET` y `HEAD`;
  - cache policy administrada `CachingOptimized` (`658327ea-f89d-4fab-a63d-7e88639e58f6`);
  - `ResponseHeadersPolicyId: !Ref PaginaHeaders`;
  - `PriceClass_100`.
- `PaginaBucketPolicy` (`AWS::S3::BucketPolicy`): solo `s3:GetObject` para el principal `cloudfront.amazonaws.com`, con condición `AWS:SourceArn` igual al ARN de `PaginaDistribucion`.

Outputs que necesitan `pnpm subir-pagina` y `pnpm verify 6`:

| Output | Valor |
|---|---|
| `PaginaUrl` | `https://<dominio de la distribución>/` |
| `PaginaBucket` | nombre del bucket |
| `DistribucionId` | ID de la distribución |

SAM no sube los archivos de `web/`. Eso lo hace `pnpm subir-pagina`, que también escribe `web/config.js` con la URL de la API.

## Paso extra B: login con Cognito (tarea 4)

- `AWS::Cognito::UserPool` con `AdminCreateUserConfig.AllowAdminCreateUserOnly: true`, un app client sin secreto y un `CognitoAuthorizer` en `GastosApi`. El `POST /gastos` sigue con `ApiKeyRequired: true` y sin autorizador. Outputs nuevos: `UserPoolId`, `UserPoolClientId`.
