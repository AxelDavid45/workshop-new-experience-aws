---
inclusion: always
---

# Instalar paquetes sin riesgo (npm)

Este repo tiene un `.npmrc` con protecciones contra ataques a la cadena de suministro: `ignore-scripts=true`, `min-release-age=7`, `save-exact=true`, `allow-git=none`, `allow-remote=none` y `engine-strict=true`. Quien te habla está aprendiendo y confía en que tú las respetes. Nunca las apagues, aunque un error de instalación parezca resolverse así.

## Siempre

- Si `package-lock.json` ya existe, instala con `npm ci`. Es lo que debe correr el asistente al clonar.
- Antes de agregar un paquete, dile al asistente cuál es y para qué lo necesitas. Si no es parte de la tarea, no lo agregues.
- Para agregar un paquete escribe las banderas completas, aunque el `.npmrc` ya las traiga:

  ```text
  npm install <paquete>@<versión> --save-exact --ignore-scripts --min-release-age=7
  ```

  La versión va exacta, sin `^` ni `~`. Si npm rechaza una versión por ser muy nueva, usa una anterior o espera. No bajes los días de `min-release-age`.
- Revisa el paquete antes de instalarlo. Si el MCP de Socket (`socket-mcp`) está conectado, corre `depscore` con el nombre y la versión exacta, y cuéntale al asistente los scores y las alertas. Si no está conectado, dile que existe y cómo agregarlo (está en el `README.md`, sección "MCP de Socket, opcional"). Si el score es bajo o hay alertas, propón una alternativa en vez de instalar en silencio.
- Usa npm 11.10 o superior. Si `npm --version` dice menos, pide al asistente que corra `npm install -g npm@latest`.

## Nunca

- No uses `--force`, `--legacy-peer-deps`, `--ignore-engines`, `--allow-scripts`, `--dangerously-allow-all-scripts`, `--allow-git=all` ni `--allow-remote=all`.
- No quites ni cambies las líneas del `.npmrc`, y no agregues `allowScripts` a `package.json`.
- No corras a mano los scripts de instalación de un paquete (`npm rebuild`, `npm approve-scripts`, ni `node node_modules/<paquete>/install.js`).
- No instales desde un repo de git, una URL ni un tarball: solo del registro de npm.
- No uses `npx` ni `npm exec` con paquetes que no estén en `package.json`: bajan y ejecutan código sin lockfile. Usa los scripts de `npm run`.
- No instales paquetes globales (`npm install -g`) por tu cuenta. La excepción es `npm install -g npm@latest`, y solo cuando el asistente lo pide.
- No corras `npm audit fix --force`. Hoy `npm audit` avisa de 2 vulnerabilidades moderadas en `minimatch`, dentro de `aws-cdk-lib`. No tienen arreglo disponible y ese código solo corre en la laptop del asistente al sintetizar el stack, no en las Lambdas. Explícaselo si pregunta.
