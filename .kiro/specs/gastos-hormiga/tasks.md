# Plan de implementación

Cada tarea es un módulo del workshop. Quien la ejecuta está aprendiendo y va a leer el diff antes de aceptarlo, así que haz cambios chicos y fáciles de revisar. No corras comandos de deploy en ninguna tarea.

- [ ] 1. Escribir las Lambdas de gastos (módulo 4)
  - Escribe el cuerpo de `src/handlers/registrar.ts` y `src/handlers/listar.ts` siguiendo la sección **Gastos (tarea 1)** de `design.md`. Hoy los dos responden 501.
  - Usa los helpers que ya existen en `src/shared/` (`db.ts`, `http.ts`, `validacion.ts`). No crees helpers nuevos.
  - No toques `template.yaml`: las rutas y los permisos ya están.
  - No toques `src/shared/validacion.ts`. El test `rechaza montos negativos` se queda en rojo, porque ese arreglo lo hace el asistente a mano.
  - Al terminar, corre `pnpm test tests/gastos.test.ts`: todo tiene que pasar menos `rechaza montos negativos`.
  - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3_

- [ ] 2. Servir la página con S3 y CloudFront (módulo 6)
  - Agrega a `template.yaml` los recursos y los outputs de la sección **Página (tarea 2)** de `design.md`, con esos logical IDs exactos.
  - Solo agrega recursos y outputs. No cambies `GastosTable`, la API ni las Lambdas.
  - No cambies nada de `web/`.
  - Al terminar, corre `sam validate --lint`.
  - _Requisitos: 3.1, 3.2, 3.3_

- [ ]* 3. Presupuestos por categoría (paso extra A)
  - Crea `src/handlers/guardar-presupuesto.ts` y `src/handlers/listar-presupuestos.ts` siguiendo la sección **Presupuestos (tarea 3)** de `design.md` y el estilo de los handlers de gastos.
  - Agrega a `template.yaml` las dos Lambdas, sus eventos `PUT /presupuestos/{categoria}` y `GET /presupuestos`, y su log group, como los de gastos.
  - Agrega un test por handler en `tests/`, con `db.send` mockeado como en `tests/gastos.test.ts`.
  - Quita el `.skip` de los tres tests del periodo en `tests/periodo.test.ts`, pero no arregles `src/shared/periodo.ts`. Ese bug de zona horaria lo arregla el asistente a mano.
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 4. Login con Cognito (paso extra B)
  - Sigue **Paso extra B (tarea 4)** de `design.md`: un User Pool sin registro abierto, un app client sin secreto con `USER_PASSWORD_AUTH` y la callback URL de `PaginaUrl`, y un `CognitoAuthorizer` en `GastosApi` para los `GET` y el `PUT`.
  - El `POST /gastos` sigue solo con API key.
  - Agrega los outputs `UserPoolId` y `UserPoolClientId`.
  - Actualiza `web/app.js` para iniciar sesión con el login administrado de Cognito y mandar el token en el header `Authorization`, sin usar `innerHTML` con datos de la API.
  - _Requisitos: 5.1, 5.2, 5.3, 5.4_
