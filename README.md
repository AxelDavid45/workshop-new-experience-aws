# ¿En qué se te va el dinero? Construye tu app de gastos hormiga con Kiro y la nueva experiencia de AWS

Repo del workshop donde construyes una app para registrar tus gastos hormiga desde la pantalla de bloqueo de tu teléfono, con AWS SAM y Kiro. La ruta base usa servicios incluidos en el Free plan y no requiere pasar al Paid plan.

**Las instrucciones viven en el sitio del workshop:** (TODO: add link del sitio publicado en CloudFront)

Si vas a tomar el taller, empieza por la sección "Antes del evento" del sitio.

## Qué hay aquí

| Carpeta o archivo | Qué hay |
|---|---|
| `template.yaml` | La infraestructura: REST API con API key, Lambdas y la tabla `GastosTable` |
| `samconfig.toml` | Stack `gastos-hormiga`, Región `us-east-2` y perfil `gastos-hormiga` |
| `src/` | Las Lambdas en TypeScript. Las de gastos están vacías: las escribe Kiro en el módulo 4 |
| `tests/` | Tests con Vitest. Varios están en rojo a propósito |
| `web/` | La página de tus gastos |
| `.kiro/specs/gastos-hormiga/` | La spec: requisitos, diseño y las tareas que le pides a Kiro |
| `.kiro/steering/workshop.md` | Lo que Kiro no puede tocar en este repo |
| `scripts/` | `pnpm verify`, `pnpm subir-pagina`, `pnpm limpiar` y los demás |

## Arranque rápido

```bash
pnpm install
pnpm verify 0
```

## Ramas

| Rama | Qué tiene |
|---|---|
| `main` | El punto de partida del módulo 0 |
| `modulo-4` | Módulo 4 terminado: las Lambdas de gastos escritas y los montos negativos rechazados |
| `modulo-6` | Módulo 6 terminado: bucket privado y CloudFront para la página |
| `base-completa` | Ruta base terminada: presupuestos y zona horaria arreglada |

`GastosTable` tiene el mismo logical ID y nombre en todas las ramas, así que cambiar de rama y volver a desplegar actualiza tu stack sin borrar tus gastos.

## Licencia

MIT-0. Ve [LICENSE](LICENSE).
