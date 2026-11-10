# App de gastos hormiga en el AWS Free Tier

**Versión del material: v6**

Aquí construyes una app para registrar tus gastos hormiga desde la pantalla de bloqueo de tu teléfono, con AWS CDK y Kiro.

**Las instrucciones viven en el [sitio del workshop](https://main.d2kzpx97pko28.amplifyapp.com/).**

Si vas a tomar el taller, empieza por la sección "Antes del evento" del sitio. Haz fork de este repo y después clónalo en tu cuenta.

> **Alcance de seguridad:** esto es un workshop temporal y solo sirve para pruebas, no para producción. `GET /gastos` es público y la API key limita uso, no autentica personas. Usa datos ficticios y elimina el backend y Amplify al terminar.

## Qué hay aquí

| Carpeta o archivo             | Qué hay                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `infra/`                      | La infraestructura con AWS CDK: REST API con API key, Lambdas y la tabla `GastosTable` |
| `cdk.json`                    | Perfil `gastos-hormiga`, stack `gastos-hormiga` y Región `us-east-2`                   |
| `src/`                        | Las Lambdas en TypeScript. Las de gastos están vacías: las escribe Kiro en el módulo 4 |
| `tests/`                      | Tests con Vitest. Varios están en rojo a propósito                                     |
| `web/`                        | La página de tus gastos                                                                |
| `amplify.yml`                 | Le dice a Amplify Hosting que publique `web/`. No corre npm a propósito                |
| `.kiro/specs/gastos-hormiga/` | La spec: requisitos, diseño y las tareas que le pides a Kiro                           |
| `.kiro/steering/`             | Las reglas de Kiro en este repo: qué no puede tocar y cómo instala paquetes            |
| `scripts/`                    | `npm run verify`, `npm run doctor`, `npm run limpiar-practica` y los demás             |
| `.npmrc`                      | Las protecciones de npm contra ataques a la cadena de suministro                       |

## Arranque rápido

Necesitas Node.js LTS, npm 11.10 o superior, Git y el AWS CLI. El sitio explica cómo instalarlos en Windows, macOS y Linux.

```bash
npm ci
```

Los checkpoints (`npm run verify N`) necesitan una sesión de AWS, así que se corren durante el taller, desde el módulo 1.

## Comandos

Todos se corren con `npm run <comando>` desde la raíz del repo y funcionan igual en Windows, macOS y Linux.

| Comando                         | Qué hace                                                                   |
| ------------------------------- | -------------------------------------------------------------------------- |
| `npm run verify <N>`            | El checkpoint del módulo N (`1`, `2 <url>`, `3`, `4`, `5 <url>`)           |
| `npm run doctor`                | Versiones, sesión de AWS, bootstrap, stack y días restantes del Free Tier  |
| `npm run bootstrap`             | Prepara tu cuenta y Región para CDK. Se hace una sola vez                  |
| `npm run synth`                 | Genera la plantilla de CloudFormation sin desplegar nada                   |
| `npm run diff`                  | Muestra qué cambiaría un deploy                                            |
| `npm run deploy`                | Despliega el stack `gastos-hormiga`                                        |
| `npm run sync`                  | `cdk watch`: sube tus cambios de `src/` al guardar. Solo para desarrollo   |
| `npm run probar`                | Registra un gasto y lista los gastos de tu API                             |
| `npm run datos`                 | La URL de tu API y tu API key (`npm run datos mostrar-key` la muestra)     |
| `npm run preparar-pagina`       | Escribe `web/config.js` con la URL de tu API                               |
| `npm run rotar-key`             | Cambia tu API key                                                          |
| `npm run limpiar-practica`      | Borra la Lambda y la tabla de la práctica manual                           |
| `npm run limpiar`               | Borra tu backend completo, incluida la tabla con tus gastos                |

## Ramas

| Rama            | Qué tiene                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `main`          | El punto de partida, con `amplify.yml` listo para publicar la página                               |
| `modulo-4`      | Módulo 4 terminado: las Lambdas de gastos escritas y los montos negativos rechazados               |
| `extra-cognito` | Paso extra experimental: login con Cognito y callback de Amplify; no es una solución de producción |

`GastosTable` tiene el mismo logical ID y nombre en todas las ramas, así que cambiar de rama y volver a desplegar actualiza tu stack sin borrar tus gastos.

## Instalar paquetes sin riesgo

El `.npmrc` de este repo activa estas protecciones cuando corres npm dentro de la carpeta:

- `ignore-scripts=true`: ningún paquete corre código al instalarse.
- `min-release-age=7`: npm no instala versiones publicadas hace menos de 7 días. Necesita npm 11.10 o superior (`npm install -g npm@latest`).
- `save-exact=true`: `package.json` guarda versiones exactas, sin `^` ni `~`.
- `allow-git=none` y `allow-remote=none`: solo se instala desde el registro de npm.
- `engine-strict=true`: falla si tu Node o tu npm no cumplen `engines`.

Para instalar lo que ya está en el lockfile usa `npm ci`. Si Kiro agrega un paquete, `.kiro/steering/npm-seguro.md` le pide escribir las banderas completas y revisar el paquete antes.

`npm audit` avisa hoy de 2 vulnerabilidades moderadas en `minimatch`, dentro de `aws-cdk-lib`. No hay arreglo disponible y ese código solo corre en tu laptop cuando CDK genera la plantilla, no en tus Lambdas. No corras `npm audit fix --force`.

## MCP de Socket, opcional

[Socket](https://socket.dev) califica cada versión de un paquete de npm en supply chain, calidad, mantenimiento, vulnerabilidades y licencia, y avisa de alertas como scripts de instalación sospechosos. Su MCP oficial deja que Kiro lo consulte antes de instalar algo. No lo necesitas para el workshop, pero es una buena costumbre.

Pídele a Kiro que lo agregue a este workspace:

```text
Agrega el MCP remoto de Socket a .kiro/settings/mcp.json de este
workspace. Nombre: socket-mcp. URL: https://mcp.socket.dev/
No pongas headers ni API keys: el servidor usa OAuth y Kiro abre el
navegador para que inicie sesión. No instales paquetes.
```

O escribe tú el archivo:

```json
{
  "mcpServers": {
    "socket-mcp": {
      "url": "https://mcp.socket.dev/"
    }
  }
}
```

Cuando Kiro abra el navegador, inicia sesión en Socket y autoriza el acceso. Después pregúntale, por ejemplo: `Revisa con Socket el score de aws-cdk-lib en la versión que usa este repo`.

Socket recibe los nombres y las versiones de los paquetes que consultas, no tu código. Un score alto no garantiza que un paquete sea seguro, y un paquete sin score no es un veredicto: úsalo como una señal más.

## Licencia

MIT-0. Ve [LICENSE](LICENSE).
