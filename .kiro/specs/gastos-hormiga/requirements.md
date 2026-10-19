# Requisitos: gastos hormiga

## Introducción

Una app para registrar gastos hormiga desde la pantalla de bloqueo del teléfono y verlos en una página. Este documento es el contrato de la API: `pnpm verify N` lo revisa contra la API desplegada, así que si algo de aquí cambia, el verify deja de pasar.

Categorías válidas en todo el documento: `cafes`, `snacks`, `transporte`, `suscripciones`, `otros`.

## Requisitos

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
3. SI `monto` no es un número, es menor o igual a 0 o es mayor a 100 000, ENTONCES LA API DEBE responder 400 con `{ "error": "..." }` y no guardar nada.
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

1. LA PÁGINA DEBE servirse por HTTPS desde una URL de CloudFront.
2. Los archivos de `web/` DEBEN vivir en un bucket que no se pueda leer directo: pedir un archivo a S3 sin pasar por CloudFront responde 403.
3. LA PÁGINA DEBE responder con el header `X-Robots-Tag: noindex`.

### Requisito 4: Presupuestos por categoría (paso extra A)

**Historia:** Como persona que gasta de más en cafés, quiero ponerme un tope por semana, para saber cuándo parar.

Rutas: `PUT /presupuestos/{categoria}` y `GET /presupuestos`, abiertas.

```json
{ "tope": 80, "periodo": "semana" }
```

#### Criterios de aceptación

1. CUANDO llega un presupuesto válido, LA API DEBE guardarlo, reemplazar el anterior de esa categoría si existía y responder 200 con `{ "categoria", "tope", "periodo", "actualizado" }`.
2. SI `{categoria}` no es una de las cinco categorías, `tope` no es mayor a 0 y menor o igual a 100 000, o `periodo` no es `semana` ni `mes`, ENTONCES LA API DEBE responder 400 con `{ "error": "..." }`.
3. CUANDO alguien pide los presupuestos, LA API DEBE responder 200 con esta forma:

```json
{
  "presupuestos": [
    {
      "categoria": "cafes",
      "tope": 80,
      "periodo": "semana",
      "gastado": 64,
      "porcentaje": 80,
      "inicio": "2026-11-02T06:00:00.000Z",
      "reiniciaEl": "2026-11-09T06:00:00.000Z"
    }
  ]
}
```

4. `gastado` DEBE ser la suma de los gastos de esa categoría desde `inicio` hasta ahora, y `porcentaje` DEBE ser `gastado / tope * 100` redondeado a entero.
5. Un presupuesto DEBE "reiniciarse" porque `gastado` se calcula por rango de fechas, nunca borrando gastos. El historial completo se conserva.
6. Las semanas DEBEN empezar el lunes a las 00:00 y los meses el día 1 a las 00:00, en `America/Mexico_City`. Un café del domingo a las 8 pm cuenta en la semana que termina ese domingo, aunque en UTC ya sea lunes. Lo revisa `tests/periodo.test.ts`.

### Requisito 5: Login con Cognito (paso extra B)

1. `GET /gastos`, `GET /presupuestos` y `PUT /presupuestos/{categoria}` DEBEN pedir un token de Cognito en el header `Authorization`. Sin token responden 401.
2. `POST /gastos` DEBE seguir con API key, para que el Atajo no se rompa.
3. No DEBE haber registro abierto: los usuarios se crean con `pnpm crear-usuario`.
4. La callback URL del app client DEBE salir del output `PaginaUrl` del stack.
