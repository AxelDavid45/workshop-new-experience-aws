# App de gastos hormiga en el AWS Free Tier

**Versión del material: v5**

Aquí construyes una app para registrar tus gastos hormiga desde la pantalla de bloqueo de tu teléfono, con AWS SAM y Kiro.

**Las instrucciones viven en el [sitio del workshop](https://main.d2kzpx97pko28.amplifyapp.com/).**

Si vas a tomar el taller, empieza por la sección "Antes del evento" del sitio. Haz fork de este repo y después clonalo en tu cuenta.

> **Alcance de seguridad:** esto es un workshop temporal y solo sirve para pruebas, no para producción. `GET /gastos` es público y la API key limita uso, no autentica personas. Usa datos ficticios y elimina el backend y Amplify al terminar.

## Qué hay aquí

| Carpeta o archivo             | Qué hay                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `template.yaml`               | La infraestructura: REST API con API key, Lambdas y la tabla `GastosTable`             |
| `samconfig.toml`              | Stack `gastos-hormiga`, Región `us-east-2` y perfil `gastos-hormiga`                   |
| `src/`                        | Las Lambdas en TypeScript. Las de gastos están vacías: las escribe Kiro en el módulo 4 |
| `tests/`                      | Tests con Vitest. Varios están en rojo a propósito                                     |
| `web/`                        | La página de tus gastos                                                                |
| `.kiro/specs/gastos-hormiga/` | La spec: requisitos, diseño y las tareas que le pides a Kiro                           |
| `.kiro/steering/workshop.md`  | Lo que Kiro no puede tocar en este repo                                                |
| `scripts/`                    | `pnpm verify`, `pnpm limpiar-practica`, `pnpm preparar-pagina` y los demás             |

## Arranque rápido

```bash
pnpm install
pnpm verify 0
```

## Ramas

| Rama                 | Qué tiene                                                                            |
| -------------------- | ------------------------------------------------------------------------------------ |
| `main`               | El punto de partida del módulo 0                                                     |
| `modulo-4`           | Módulo 4 terminado: las Lambdas de gastos escritas y los montos negativos rechazados |
| `modulo-6`           | Módulo 6 terminado: configuración de Amplify Hosting para la página                  |
| `extra-cognito`      | Paso extra experimental: login con Cognito y callback de Amplify; no es una solución de producción |

`GastosTable` tiene el mismo logical ID y nombre en todas las ramas, así que cambiar de rama y volver a desplegar actualiza tu stack sin borrar tus gastos.

## Licencia

MIT-0. Ve [LICENSE](LICENSE).
