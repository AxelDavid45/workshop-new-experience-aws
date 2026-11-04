---
inclusion: always
---

# Reglas del workshop de gastos hormiga

Este repo es el starter de un workshop. Quien te pide algo aquí está aprendiendo y va a revisar tu diff antes de aceptarlo, así que haz cambios chicos y fáciles de leer.

## Antes de escribir código

- El trabajo de este repo está en la spec `.kiro/specs/gastos-hormiga/`. Cada tarea de `tasks.md` dice qué archivos tocar y qué sección de `design.md` seguir. Lo que dicen `requirements.md` y `design.md` no se negocia, aunque te parezca que hay una forma mejor.
- Si te piden algo que no está en una tarea, sigue igual `design.md` y estas reglas.
- Sigue el estilo de los handlers que ya existen en `src/handlers/` y usa los helpers de `src/shared/`.

## Lo que nunca haces

- No corras comandos de deploy ni de sync: nada de `cdk deploy`, `cdk watch`, `cdk destroy`, `cdk bootstrap`, `npm run bootstrap`, `npm run deploy`, `npm run sync`, `npm run limpiar`, `npm run rotar-key` ni `npm run preparar-pagina`. El asistente despliega cuando revisó tu diff.
- No cambies el logical ID `GastosTable` (el `overrideLogicalId` de `infra/gastos-stack.ts`), su `tableName`, sus llaves ni su `removalPolicy`.
- No cambies el contrato de la API (rutas, status codes, nombres de campos) ni la lista de categorías.
- No agregues dependencias nuevas a `package.json`. Las reglas para instalar paquetes están en `.kiro/steering/npm-seguro.md`.
- No uses `resources: ['*']` ni los helpers `grantReadWriteData` o `grantFullAccess`. Cada Lambda lleva un `PolicyStatement` con solo las acciones que usa, sobre `GastosTable`.
- No crees recursos fuera de `infra/gastos-stack.ts` ni en otra Región que no sea la del proyecto.
- No arregles tests en rojo que no son parte de tu tarea. Algunos están en rojo a propósito y los arregla el asistente a mano (`rechaza montos negativos`).

## Cuando termines

- Corre `npm test` y `npm run typecheck` y di qué pasó, incluidos los tests que siguen en rojo a propósito.
- Resume en una lista corta qué archivos cambiaste y por qué, para que el asistente sepa dónde mirar en el diff.
