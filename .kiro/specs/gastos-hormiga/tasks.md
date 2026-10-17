# Implementation Plan

## Overview

Cada tarea es un módulo del workshop. Quien la ejecuta está aprendiendo y va a leer el diff antes de aceptarlo, así que haz cambios chicos y fáciles de revisar. No corras comandos de deploy en ninguna tarea.

## Task Dependency Graph

Las tareas 1 y 2 son independientes. La tarea 3 necesita las dos: agrega login al backend de la tarea 1 y usa la URL de la página que queda lista con la tarea 2.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 2],
      "dependsOn": []
    },
    {
      "wave": 2,
      "tasks": [3],
      "dependsOn": [1, 2]
    }
  ]
}
```

```text
1 ─┐
   ├──> 3
2 ─┘
```

## Tasks

- [x] 1. Escribir las Lambdas de gastos (módulo 4)
  - Escribe el cuerpo de `src/handlers/registrar.ts` y `src/handlers/listar.ts` siguiendo la sección **Gastos (tarea 1)** de `design.md`. Hoy los dos responden 501.
  - Usa los helpers que ya existen en `src/shared/` (`db.ts`, `http.ts`, `validacion.ts`). No crees helpers nuevos.
  - No toques `template.yaml`: las rutas y los permisos ya están.
  - No toques `src/shared/validacion.ts`. El test `rechaza montos negativos` se queda en rojo, porque ese arreglo lo hace el asistente a mano.
  - Al terminar, corre `pnpm test tests/gastos.test.ts`: todo tiene que pasar menos `rechaza montos negativos`.
  - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3_

- [ ] 2. Preparar la página para Amplify Hosting (módulo 6)
  - Crea `amplify.yml` siguiendo la sección **Página (tarea 2)** de `design.md`.
  - Solo crea ese archivo. No cambies `template.yaml`, `GastosTable`, la API, las Lambdas ni `web/`.
  - No conectes GitHub ni ejecutes deploys: eso lo hace el asistente desde la consola de Amplify después de revisar el diff.
  - Al terminar, corre `pnpm typecheck`.
  - _Requisitos: 3.1, 3.2_

- [ ]* 3. Login con Cognito (paso extra)
  - Sigue **Paso extra: login con Cognito (tarea 3)** de `design.md`: agrega el parámetro `FrontendUrl`, un User Pool sin registro abierto, un app client sin secreto con `USER_PASSWORD_AUTH`, `PreventUserExistenceErrors: ENABLED` y esa URL como callback, y un `CognitoAuthorizer` en `GastosApi` para `GET /gastos`.
  - El `POST /gastos` sigue solo con API key. Este ejercicio no separa datos por usuario: no lo presentes como una solución multiusuario.
  - Agrega los outputs `UserPoolId` y `UserPoolClientId`.
  - Actualiza `web/app.js` para iniciar sesión con el login administrado de Cognito y mandar el token en el header `Authorization`, sin usar `innerHTML` con datos de la API.
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_
