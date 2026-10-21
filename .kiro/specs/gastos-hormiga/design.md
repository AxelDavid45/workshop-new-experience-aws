# Diseño: gastos hormiga

Cómo se construye lo que pide `requirements.md`. Lo que dice este archivo no se negocia, aunque haya otra forma que parezca mejor: los checkpoints del workshop (`pnpm verify N`) y las ramas de solución dependen de estos nombres.

## Infraestructura

- La infraestructura del backend final vive en `template.yaml`, con AWS SAM. Amplify Hosting publica `web/` desde GitHub y se configura con archivos del repo, no con recursos de este template. La Lambda y la tabla de la práctica manual son efímeras: usan nombres fijos y se borran con `pnpm limpiar-practica` antes del primer deploy.
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

Una sola tabla para los gastos de la ruta base. Este esquema no se modifica.

| Atributo | Tipo   | Rol           |
| -------- | ------ | ------------- |
| `pk`     | String | Partition key |
| `sk`     | String | Sort key      |

| Qué guarda | `pk`     | `sk`                            | Otros atributos                                              |
| ---------- | -------- | ------------------------------- | ------------------------------------------------------------ |
| Un gasto   | `GASTOS` | `GASTO#<fecha ISO en UTC>#<id>` | `id`, `fecha`, `monto`, `descripcion`, `categoria`, `origen` |

Como la `sk` de los gastos empieza con la fecha, un `Query` con `pk = GASTOS` regresa los gastos ya ordenados. Los helpers están en `src/shared/db.ts`.

No se agregan índices secundarios (GSI ni LSI).

## API

- Es una REST API (`AWS::Serverless::Api`), no HTTP API: los usage plans y las API keys solo existen en REST.
- Un solo stage: `v1`.
- CORS: `AllowOrigin '*'`, headers `Content-Type,x-api-key,x-origen`, métodos `GET,POST,OPTIONS`. Las respuestas de las Lambdas incluyen `Access-Control-Allow-Origin: *` (lo hace `src/shared/http.ts`).
- Throttling del stage: 5 peticiones por segundo, ráfaga de 5, para todos los métodos.
- `GastosApiKey` con nombre `${AWS::StackName}-key-${VersionKey}`. Rotar la key es cambiar el parámetro `VersionKey` (`pnpm rotar-key`).
- `GastosUsagePlan`: 2 peticiones por segundo, ráfaga de 4, cuota de 500 al día. Solo limita a quien trae la API key.

| Método y ruta  | Auth    | Lambda                   | Permisos de la Lambda                  |
| -------------- | ------- | ------------------------ | -------------------------------------- |
| `POST /gastos` | API key | `RegistrarGastoFunction` | `dynamodb:PutItem` sobre `GastosTable` |
| `GET /gastos`  | Abierto | `ListarGastosFunction`   | `dynamodb:Query` sobre `GastosTable`   |

Cada Lambda tiene solo los permisos de su fila, escritos como `Statement` explícito. Nada de `DynamoDBCrudPolicy` ni `Resource: '*'`.

Categorías fijas: `cafes`, `snacks`, `transporte`, `suscripciones`, `otros` (`src/shared/categorias.ts`).

## Outputs

El stack publica estos tres outputs y `pnpm verify N` depende de sus nombres. Si cambian, el checkpoint truena.

| Output        | Qué es                          | Quién lo usa                            |
| ------------- | ------------------------------- | --------------------------------------- |
| `ApiUrl`      | URL base de la API (stage `v1`) | `pnpm preparar-pagina`, `pnpm verify`   |
| `ApiKeyId`    | ID de la API key, no el valor   | `pnpm datos`, `pnpm verify`             |
| `TablaGastos` | Nombre de `GastosTable`         | `pnpm verify`, para borrar lo de prueba |

## Gastos (tarea 1)

`src/handlers/registrar.ts` y `src/handlers/listar.ts` ya existen como versión vacía que responde 501. La tarea es escribir su cuerpo; el template, los permisos y los helpers ya están listos.

- **Registrar (`POST /gastos`):**
  - lee el body con `leerBody(event)` y lo valida con `validarGasto()` de `src/shared/validacion.ts`;
  - si no es válido, responde `error(400, motivo)`;
  - arma el gasto con `id: randomUUID()`, `fecha: new Date().toISOString()` y `origen: normalizarOrigen(header(event, 'x-origen'))`;
  - lo guarda con un `PutCommand` en `TABLE_NAME`, con `pk: PK_GASTOS` y `sk: skGasto(fecha, id)`;
  - responde `json(201, gasto)`, sin `pk` ni `sk`.
- **Listar (`GET /gastos`):**
  - un `QueryCommand` con `KeyConditionExpression: 'pk = :pk'`, `ScanIndexForward: false` y `Limit: 200`, nunca `Scan`;
  - responde `json(200, { gastos })` con solo `id`, `fecha`, `monto`, `descripcion`, `categoria` y `origen` de cada item.
- La validación de montos ≤ 0 en `validacion.ts` no es parte de la tarea: la agrega el asistente a mano después.

## Estilo de los handlers

- Un archivo por handler en `src/handlers/`, que exporta `handler`.
- Lo compartido vive en `src/shared/`: `db.ts` (cliente y llaves), `http.ts` (`json`, `error`, `leerBody`, `header`), `categorias.ts` y `validacion.ts`.
- La validación regresa `{ ok: true, valor }` o `{ ok: false, error }`, y el handler responde 400 con `{ "error": "..." }`.
- Cada handler nuevo lleva su test en `tests/`, con `db.send` reemplazado por un mock (ver `tests/gastos.test.ts`).

## Página (tarea 2)

Los archivos de la página ya existen en `web/` y no cambian. El asistente hace fork del starter en GitHub y conecta la rama `main` con Amplify Hosting desde la consola. Kiro solo prepara la configuración que vive en el repo:

- `amplify.yml` en la raíz, que define `web/` como `baseDirectory` de los artefactos estáticos. No instala dependencias ni compila nada: la página ya viene lista.

No se agregan recursos de hosting, outputs ni permisos a `template.yaml`. No se modifica `web/` durante la tarea.

Después de aceptar el diff, el asistente corre `pnpm preparar-pagina`. Ese comando escribe `web/config.js` con una constante `API_URL` que `web/app.js` importa como módulo. Luego hace commit y push a `main`; Amplify detecta el push, despliega la página y entrega una URL HTTPS. `pnpm verify 6 <url-de-amplify>` revisa la página y `config.js`.

## Paso extra: login con Cognito (tarea 3)

- `AWS::Cognito::UserPool` con `AdminCreateUserConfig.AllowAdminCreateUserOnly: true`, un app client sin secreto con `USER_PASSWORD_AUTH` en sus `ExplicitAuthFlows` (lo usan `pnpm crear-usuario` y `pnpm verify cognito`) y un `CognitoAuthorizer` en `GastosApi`. El `POST /gastos` sigue con `ApiKeyRequired: true` y sin autorizador. El template recibe `FrontendUrl` como parámetro para usar la URL HTTPS de Amplify en la callback. Outputs nuevos: `UserPoolId`, `UserPoolClientId`.
- **La página con Cognito:** se actualiza `web/app.js` para iniciar sesión con el login administrado de Cognito (hosted UI) y mandar el `IdToken` en el header `Authorization` al pedir `GET /gastos`. Como en la ruta base, los datos de la API se pintan con `textContent`, nunca con `innerHTML`.
