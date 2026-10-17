// pnpm subir-pagina
// SAM no sube los archivos de la página a S3, así que lo hacemos aquí:
//   1. escribe web/config.js con la URL de tu API
//   2. aws s3 sync web/ al bucket privado
//   3. invalida el caché de CloudFront para que veas el cambio

import { execFile } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { CONFIG, ROOT, aws } from './lib/aws.ts'
import { falla, gris, ok, titulo } from './lib/consola.ts'
import { salidasDelStack } from './lib/stack.ts'

const run = promisify(execFile)

async function main() {
  titulo('Subiendo tu página')
  const s = await salidasDelStack()
  if (!s.PaginaBucket || !s.DistribucionId) {
    falla('Tu stack todavía no tiene el bucket ni la distribución', 'Eso se agrega en el módulo 6. ¿Ya reanudaste pnpm sync después de aceptar el diff?')
    process.exitCode = 1
    return
  }

  const config = `// Lo genera pnpm subir-pagina. No lo edites a mano.\nwindow.GASTOS_CONFIG = ${JSON.stringify({ apiUrl: s.ApiUrl }, null, 2)}\n`
  writeFileSync(path.join(ROOT, 'web', 'config.js'), config)
  ok('web/config.js apunta a tu API')

  await run(
    'aws',
    ['s3', 'sync', path.join(ROOT, 'web'), `s3://${s.PaginaBucket}`, '--delete', '--exclude', '.*', '--profile', CONFIG.perfil, '--region', CONFIG.region],
    { maxBuffer: 10 * 1024 * 1024 },
  )
  ok(`Archivos subidos a s3://${s.PaginaBucket}`)

  const inv = await aws<{ Invalidation: { Id: string } }>(
    ['cloudfront', 'create-invalidation', '--distribution-id', s.DistribucionId, '--paths', '/*'],
    { region: 'us-east-1' },
  )
  ok(`Invalidación de CloudFront creada ${gris(`(${inv.Invalidation.Id})`)}`)
  console.log(`\nTu página: ${s.PaginaUrl}`)
  console.log(gris('Si es la primera vez, CloudFront puede tardar unos minutos en responder.'))
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
