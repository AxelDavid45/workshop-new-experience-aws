# Design Document

## Overview

Cómo se construye lo que pide `requirements.md`. Lo que dice este archivo no se negocia, aunque haya otra forma que parezca mejor: los checkpoints del workshop (`npm run verify N`) y las ramas de solución dependen de estos nombres.

## Architecture

### Infraestructura

- La infraestructura del backend final vive en `infra/gastos-stack.ts`, con AWS CDK en TypeScript. `infra/app.ts` crea el stack y `cdk.json` dice cómo ejecutarlo. Amplify Hosting publica `web/` desde GitHub y se configura con archivos del repo, no con recursos de este stack. La Lambda y la tabla de la práctica manual son efímeras: usan nombres fijos y se borran con `npm run limpiar-practica` antes del primer deploy.
- CDK necesita un bootstrap una vez por cuenta y Región (`npm run bootstrap`): crea el bucket donde se suben los paquetes de las Lambdas. Ese stack (`CDKToolkit`) no es parte de `gastos-hormiga` y `npm run limpiar` no lo borra.
- Stack `gastos-hormiga` en la Región del proyecto. Salen de `cdk.json`: `context.stackName`, `context.region` y `profile`.
- Todo recurso que acepte tags lleva `workshop=gastos-hormiga` (`Tags.of(this).add(...)` en el stack).
- Runtime fijado en `Runtime.NODEJS_24_X`, arquitectura `Architecture.ARM_64`.
- Cada Lambda tiene `functionName: ${stackName}-<nombre>` y su `LogGroup` con el mismo nombre, `RetentionDays.TWO_WEEKS` y `removalPolicy: DESTROY`, para que `npm run limpiar` también borre los logs.
- Las Lambdas son `NodejsFunction`: CDK las empaqueta con el esbuild del repo desde `src/handlers/`, en formato ESM, con `@aws-sdk/*` como external porque ya viene en el runtime.
- `tests/infra.test.ts` revisa estas reglas sobre la plantilla que CDK genera, sin credenciales de AWS.

## Data Models

### La tabla de DynamoDB

`GastosTable` no se toca. Estas reglas existen porque un cambio aquí puede borrar tus gastos:

- El logical ID es `GastosTable` en todas las ramas. CDK arma los logical IDs con un hash del id y la ruta del constructo, así que el stack los fija con `overrideLogicalId('GastosTable')`. Si cambia, CloudFormation borra la tabla vieja con tus gastos y crea una vacía.
- `tableName` es fijo: `${stackName}-gastos`. Con nombre propio, CloudFormation no puede hacer un update que reemplace la tabla: el deploy falla y hace rollback en vez de perder los datos en silencio.
- `removalPolicy: RemovalPolicy.DESTROY` (CDK usa `RETAIN` por default en las tablas), para que `npm run limpiar` borre todo.
- `billingMode: BillingMode.PAY_PER_REQUEST`.

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

## Components and Interfaces

### API

- Es una REST API (`RestApi` de `aws-cdk-lib/aws-apigateway`), no HTTP API: los usage plans y las API keys solo existen en REST. Sin rol de CloudWatch a nivel cuenta (`cloudWatchRole: false`).
- Un solo stage: `v1`.
- CORS (`defaultCorsPreflightOptions`): `allowOrigins ['*']`, headers `Content-Type,x-api-key,x-origen`, métodos `GET,POST,OPTIONS`. Las respuestas de las Lambdas incluyen `Access-Control-Allow-Origin: *` (lo hace `src/shared/http.ts`). CORS no autentica la API: esta configuración solo sirve para los forks del workshop con datos ficticios y debe revisarse antes de producción.
- Throttling del stage: 5 peticiones por segundo, ráfaga de 5, para todos los métodos.
- `GastosApiKey` con nombre `${stackName}-key-${VersionKey}`. Rotar la key es cambiar el parámetro `VersionKey` (un `CfnParameter` del stack) con `npm run rotar-key`.
- `GastosUsagePlan`: 2 peticiones por segundo, ráfaga de 4, cuota de 500 al día. Solo limita a quien trae la API key.

| Método y ruta  | Auth    | Lambda                   | Permisos de la Lambda                  |
| -------------- | ------- | ------------------------ | -------------------------------------- |
| `POST /gastos` | API key | `RegistrarGastoFunction` | `dynamodb:PutItem` sobre `GastosTable` |
| `GET /gastos`  | Abierto | `ListarGastosFunction`   | `dynamodb:Query` sobre `GastosTable`   |

Cada Lambda tiene solo los permisos de su fila, escritos como `PolicyStatement` explícito con `addToRolePolicy`. Nada de `grantReadWriteData` ni `resources: ['*']`.

Categorías fijas: `cafes`, `snacks`, `transporte`, `suscripciones`, `otros` (`src/shared/categorias.ts`).

### Outputs

El stack publica estos tres outputs y `npm run verify N` depende de sus nombres. Si cambian, el checkpoint truena.

| Output        | Qué es                          | Quién lo usa                            |
| ------------- | ------------------------------- | --------------------------------------- |
| `ApiUrl`      | URL base de la API (stage `v1`) | `npm run preparar-pagina`, `npm run verify`   |
| `ApiKeyId`    | ID de la API key, no el valor   | `npm run datos`, `npm run verify`             |
| `TablaGastos` | Nombre de `GastosTable`         | `npm run verify`, para borrar lo de prueba |

### Página

Los archivos de la página ya existen en `web/` y no cambian. El asistente hace fork del starter en GitHub y conecta la rama `main` con Amplify Hosting desde la consola. No hay tarea de Kiro para esto: la configuración que vive en el repo ya viene hecha.

- `amplify.yml` en la raíz define `web/` como `baseDirectory` de los artefactos estáticos. No instala dependencias ni compila nada: la página ya viene lista. Tampoco corre npm, porque el npm de Amplify es más viejo que el que pide `package.json` (`engines`) y `engine-strict=true` en `.npmrc` haría fallar el build. `tests/amplify.test.ts` lo vigila.

No se agregan recursos de hosting, outputs ni permisos a `infra/gastos-stack.ts`.

Amplify publica la página en el módulo 2 sin `web/config.js`, y `web/app.js` avisa que todavía no apunta a una API. Después de desplegar la API (módulo 4), el asistente corre `npm run preparar-pagina`. Ese comando escribe `web/config.js` con una constante `API_URL` que `web/app.js` importa como módulo. El archivo está ignorado para no subirlo por accidente: después de revisar que solo contiene la URL pública de la API, el asistente usa `git add -f web/config.js`, hace commit y push a `main`. Amplify detecta el push y vuelve a publicar la página. `npm run verify 2 <url-de-amplify>` revisa `amplify.yml` y que la página responda; `npm run verify 5 <url-de-amplify>` revisa además `config.js`.

### Gastos (tarea 1)

`src/handlers/registrar.ts` y `src/handlers/listar.ts` ya existen como versión vacía que responde 501. La tarea es escribir su cuerpo; el stack, los permisos y los helpers ya están listos.

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

### Estilo de los handlers

- Un archivo por handler en `src/handlers/`, que exporta `handler`.
- Lo compartido vive en `src/shared/`: `db.ts` (cliente y llaves), `http.ts` (`json`, `error`, `leerBody`, `header`), `categorias.ts` y `validacion.ts`.
- La validación regresa `{ ok: true, valor }` o `{ ok: false, error }`, y el handler responde 400 con `{ "error": "..." }`.
- Cada handler nuevo lleva su test en `tests/`, con `db.send` reemplazado por un mock (ver `tests/gastos.test.ts`).

### Paso extra: login con Cognito (tarea 2)

- Un `UserPool` con `selfSignUpEnabled: false` (solo el administrador crea usuarios), un app client sin secreto con `authFlows.userPassword` (lo usan `npm run crear-usuario` y `npm run verify cognito`), `preventUserExistenceErrors: true` y un `CognitoUserPoolsAuthorizer` en `GastosApi`. El `POST /gastos` sigue con `apiKeyRequired: true` y sin autorizador. El stack recibe `FrontendUrl` como `CfnParameter` para usar la URL HTTPS de Amplify en la callback. Outputs nuevos: `UserPoolId`, `UserPoolClientId`.
- **Límite del ejercicio:** la tabla usa una sola partición `GASTOS`, así que Cognito demuestra autenticación de `GET` para una persona, no aislamiento de datos entre usuarios. Un producto multiusuario debe particionar por el claim `sub` y autorizar también las escrituras.
- **La página con Cognito:** se actualiza `web/app.js` para iniciar sesión con el login administrado de Cognito (hosted UI) y mandar el `IdToken` en el header `Authorization` al pedir `GET /gastos`. Como en la ruta base, los datos de la API se pintan con `textContent`, nunca con `innerHTML`.
