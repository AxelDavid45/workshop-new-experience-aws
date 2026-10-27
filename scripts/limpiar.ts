// pnpm limpiar borra solo el stack conocido del workshop: API, Lambdas y tabla.
// La app de Amplify se elimina aparte desde la consola.

import { spawn } from 'node:child_process'
import { CONFIG, ROOT } from './lib/aws.ts'
import { argumentos, ok, preguntar, rojo, titulo } from './lib/consola.ts'

async function todo() {
  titulo(`Borrar ${CONFIG.stack} completo`)
  console.log(rojo('Esto borra tu API, tus Lambdas y la tabla con TODOS tus gastos. No se puede deshacer. La app de Amplify se borra después desde la consola.'))
  const respuesta = await preguntar(`Escribe ${CONFIG.stack} para confirmar: `)
  if (respuesta !== CONFIG.stack) {
    console.log('No borré nada.')
    return
  }

  const codigo = await new Promise<number>((resolve) => {
    const sam = spawn('sam', ['delete', '--stack-name', CONFIG.stack, '--no-prompts', '--profile', CONFIG.perfil, '--region', CONFIG.region], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    sam.on('close', (c) => resolve(c ?? 1))
  })
  if (codigo === 0) ok('Backend borrado. Ahora elimina la app de Amplify desde la consola de AWS.')
  process.exitCode = codigo
}

async function main() {
  const { banderas, posicionales } = argumentos()
  if (banderas.size > 0 || posicionales.length > 0) {
    console.error('pnpm limpiar no acepta argumentos. Solo borra el stack conocido del workshop.')
    process.exitCode = 1
    return
  }
  await todo()
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
