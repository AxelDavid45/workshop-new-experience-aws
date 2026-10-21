// pnpm limpiar              borra el backend: API, Lambdas y tabla con tus gastos.
// El hosting vive en Amplify: al final eliminas esa app desde la consola de AWS.
// pnpm limpiar --solo-extras deja tu app y revisa lo que sobró de las actividades del módulo 2
//
// SAM borra los recursos declarados en template.yaml; Amplify Hosting se limpia
// por separado porque se conecta a tu repositorio de GitHub.

import { spawn } from 'node:child_process'
import { CONFIG, ROOT, aws } from './lib/aws.ts'
import { argumentos, aviso, gris, ok, preguntar, rojo, titulo } from './lib/consola.ts'

async function confirmar(pregunta: string): Promise<boolean> {
  return /^s(i|í)?$/i.test(await preguntar(`${pregunta} [s/N] `))
}

async function soloExtras() {
  titulo('Lo que sobró del módulo 2')
  let encontrados = 0

  const ec2 = await aws<{ Reservations: { Instances: { InstanceId: string; State: { Name: string } }[] }[] }>([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=instance-state-name,Values=pending,running,stopping,stopped',
  ])
  for (const i of ec2.Reservations.flatMap((r) => r.Instances)) {
    encontrados++
    console.log(`Instancia de EC2 ${i.InstanceId} (${i.State.Name})`)
    if (await confirmar('  ¿La termino?')) {
      await aws(['ec2', 'terminate-instances', '--instance-ids', i.InstanceId])
      ok('  Terminada')
    }
  }

  const rds = await aws<{ DBInstances: { DBInstanceIdentifier: string; DBInstanceStatus: string; DBClusterIdentifier?: string }[] }>([
    'rds',
    'describe-db-instances',
  ])
  for (const db of rds.DBInstances) {
    encontrados++
    console.log(`Base de datos de RDS ${db.DBInstanceIdentifier} (${db.DBInstanceStatus})`)
    if (db.DBClusterIdentifier) {
      aviso('  Es parte de un cluster de Aurora', 'Bórrala desde la consola de RDS: primero la instancia y luego el cluster')
      continue
    }
    if (await confirmar('  ¿La borro? (sin snapshot final, no se puede deshacer)')) {
      await aws(['rds', 'delete-db-instance', '--db-instance-identifier', db.DBInstanceIdentifier, '--skip-final-snapshot', '--delete-automated-backups'])
      ok('  Borrándose (tarda unos minutos)')
    }
  }

  const lambdas = await aws<{ Functions: { FunctionName: string }[] }>(['lambda', 'list-functions'])
  for (const f of lambdas.Functions.filter((f) => !f.FunctionName.startsWith(`${CONFIG.stack}-`))) {
    encontrados++
    console.log(`Lambda ${f.FunctionName} (no es de tu app)`)
    if (await confirmar('  ¿La borro?')) {
      await aws(['lambda', 'delete-function', '--function-name', f.FunctionName])
      ok('  Borrada')
    }
  }

  if (encontrados === 0) ok('No quedó nada prendido de las actividades. Tu app sigue intacta.')
}

async function todo(sinPreguntar: boolean) {
  titulo(`Borrar ${CONFIG.stack} completo`)
  console.log(rojo('Esto borra tu API, tus Lambdas y la tabla con TODOS tus gastos. No se puede deshacer. La app de Amplify se borra después desde la consola.'))
  if (!sinPreguntar) {
    const respuesta = await preguntar(`Escribe ${CONFIG.stack} para confirmar: `)
    if (respuesta !== CONFIG.stack) {
      console.log('No borré nada.')
      return
    }
  }

  const codigo = await new Promise<number>((resolve) => {
    const sam = spawn('sam', ['delete', '--stack-name', CONFIG.stack, '--no-prompts', '--profile', CONFIG.perfil, '--region', CONFIG.region], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    sam.on('close', (c) => resolve(c ?? 1))
  })
  if (codigo === 0) ok('Backend borrado. Ahora elimina la app de Amplify desde la consola de AWS y corre pnpm limpiar --solo-extras para revisar lo demás.')
  process.exitCode = codigo
}

async function main() {
  const { banderas } = argumentos()
  if (banderas.has('solo-extras')) await soloExtras()
  else await todo(banderas.has('si'))
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
