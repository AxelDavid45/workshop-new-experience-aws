// pnpm preparar-pagina
// Escribe web/config.js con la URL de tu API y los valores públicos de Cognito.
// Después lo agregas de forma explícita, haces commit y push; Amplify publica
// la página.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/aws.ts'
import { falla, gris, ok, titulo } from './lib/consola.ts'
import { salidasDelStack } from './lib/stack.ts'

async function main() {
  titulo('Preparar tu página para Amplify')
  const s = await salidasDelStack()
  if (!s.ApiUrl) {
    falla('Tu stack todavía no tiene la URL de la API', 'Despliega la API del módulo 4 antes de preparar la página.')
    process.exitCode = 1
    return
  }

  const config = [
    '// Lo genera pnpm preparar-pagina. No lo edites a mano.',
    `export const API_URL = ${JSON.stringify(s.ApiUrl)}`,
    `export const COGNITO_DOMAIN = ${JSON.stringify(s.CognitoDomain ?? '')}`,
    `export const COGNITO_CLIENT_ID = ${JSON.stringify(s.UserPoolClientId ?? '')}`,
    '',
  ].join('\n')
  writeFileSync(path.join(ROOT, 'web', 'config.js'), config)
  ok('web/config.js apunta a tu API')
  if (s.CognitoDomain && s.UserPoolClientId) ok('web/config.js también tiene el login de Cognito')

  console.log('\nAhora guarda y sube este cambio a tu fork:')
  console.log(gris('  git add -f web/config.js'))
  console.log(gris('  git commit -m "Publica mi página de gastos"'))
  console.log(gris('  git push origin main'))
  console.log(gris('\nAmplify Hosting detecta el push y publica la página.'))
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
