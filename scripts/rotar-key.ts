// npm run rotar-key incrementa VersionKey y CloudFormation reemplaza la API key.
// Pausa npm run sync primero para no iniciar dos deploys al mismo tiempo.

import { CONFIG, correrCdk } from './lib/aws.ts'
import { gris, ok, titulo } from './lib/consola.ts'
import { describirStack, valorDeLaKey } from './lib/stack.ts'

async function main() {
  titulo('Rotando tu API key')
  const { parametros } = await describirStack()
  const actual = Number(parametros.VersionKey ?? '1')
  const nueva = String(actual + 1)
  console.log(gris(`VersionKey ${actual} → ${nueva}. CDK despliega el cambio y reemplaza la key.`))

  const codigo = await correrCdk(['deploy', CONFIG.stack, '--parameters', `${CONFIG.stack}:VersionKey=${nueva}`])
  if (codigo !== 0) {
    process.exitCode = codigo
    return
  }

  const { salidas } = await describirStack()
  const valor = await valorDeLaKey(salidas.ApiKeyId!)
  ok('Key nueva lista. La anterior ya no funciona.')
  console.log(`Nueva API key: ${valor.slice(0, 4)}${'•'.repeat(12)} ${gris('(npm run datos mostrar-key para verla completa)')}`)
  console.log('Actualízala en tu Atajo, en el header x-api-key.')
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
