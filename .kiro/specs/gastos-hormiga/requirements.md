# Requirements Document

## Introduction

Una app para registrar gastos hormiga desde la pantalla de bloqueo del teléfono y verlos en una página. Este documento es el contrato de la API: `pnpm verify N` lo revisa contra la API desplegada, así que si algo de aquí cambia, el verify deja de pasar.

Categorías válidas en todo el documento: `cafes`, `snacks`, `transporte`, `suscripciones`, `otros`.

## Requirements

### Requisito 1: Registrar un gasto

**Historia:** Como persona que se toma un café, quiero registrar el gasto desde mi teléfono, para saber después en qué se me fue el dinero.

Ruta: `POST /gastos`, con API key en el header `x-api-key`.

```json
{
  "monto": 45,
  "descripcion": "café de la esquina",
  "categoria": "cafes"
}
```

#### Criterios de aceptación

1. CUANDO llega un gasto válido, LA API DEBE guardarlo y responder 201 con el gasto guardado: `id`, `fecha` (ISO en UTC), `origen`, `monto`, `descripcion` y `categoria`.
2. LA API DEBE aceptar `monto` como número o como texto (`"45.5"`), porque así lo manda el Atajo, y guardarlo redondeado a 2 decimales.
3. SI `monto` no es un número, es menor o igual a 0 o es mayor a 100 000, ENTONCES LA API DEBE responder 400 con `{ "error": "..." }` y no guardar nada. La cláusula de menor o igual a 0 la agrega el asistente a mano en `src/shared/validacion.ts` (módulo 4); lo demás ya viene en el starter.
4. SI `descripcion` no tiene entre 1 y 120 caracteres, ENTONCES LA API DEBE responder 400.
5. SI `categoria` no es una de las cinco categorías, ENTONCES LA API DEBE responder 400. Se acepta con acentos y mayúsculas (`Cafés`) y se guarda normalizada.
6. LA API DEBE guardar el header opcional `x-origen` como `atajo`, `curl`, `pagina` o `verify`, y cualquier otro valor como `otro`.
7. SI la petición no trae API key o la key no es válida, ENTONCES API Gateway DEBE responder 403 sin ejecutar la Lambda.
8. SI la petición rebasa el throttling, ENTONCES API Gateway DEBE responder 429.

### Requisito 2: Listar gastos

**Historia:** Como persona que registra sus gastos, quiero ver la lista, para saber cuánto llevo.

Ruta: `GET /gastos`, abierto (sin API key).

#### Criterios de aceptación

1. CUANDO alguien pide la lista, LA API DEBE responder 200 con `{ "gastos": [...] }`.
2. LA API DEBE regresar los gastos más recientes primero, máximo 200.
3. Cada gasto de la lista DEBE traer solo `id`, `fecha`, `monto`, `descripcion`, `categoria` y `origen`, sin `pk` ni `sk`.

### Requisito 3: Ver los gastos en una página

**Historia:** Como persona que registra sus gastos, quiero verlos desde cualquier navegador, para no depender de la terminal.

#### Criterios de aceptación

1. LA PÁGINA DEBE servirse por HTTPS desde la URL de la rama `main` en Amplify Hosting después de hacer push al repositorio de GitHub del asistente.
2. El repo DEBE tener `amplify.yml` que publique `web/`.
3. `web/config.js` DEBE apuntar a `ApiUrl` antes del push que publica la página.

### Requisito 4: Login con Cognito (paso extra)

1. `GET /gastos` DEBE pedir un token de Cognito en el header `Authorization`. Sin token responde 401.
2. `POST /gastos` DEBE seguir con API key, para que el Atajo no se rompa.
3. No DEBE haber registro abierto: los usuarios se crean con `pnpm crear-usuario`.
4. La callback URL del app client DEBE recibir la URL HTTPS de la página de Amplify mediante el parámetro `FrontendUrl` del stack.
5. LA PÁGINA DEBE iniciar sesión con el login administrado de Cognito y mandar el `IdToken` en el header `Authorization` al pedir la lista; los datos de la API se pintan sin `innerHTML`.
