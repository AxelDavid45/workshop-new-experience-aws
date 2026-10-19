// Borra únicamente los recursos de la práctica manual previa a SAM.
// No toca el stack gastos-hormiga ni otros recursos del proyecto.

import { pathToFileURL } from 'node:url'
import { CONFIG, aws } from './lib/aws.ts'
import { argumentos, aviso, gris, ok, preguntar, titulo } from './lib/consola.ts'

export const FUNCION_PRACTICA = 'gastos-hormiga-practica-funcion'
export const TABLA_PRACTICA = 'gastos-hormiga-practica-tabla'
export const LOG_GROUP_PRACTICA = `/aws/lambda/${FUNCION_PRACTICA}`
const PREFIJO_ROL = `${FUNCION_PRACTICA}-role-`

export type EjecutarAws = <T = any>(args: string[], opciones?: { region?: string }) => Promise<T>

function noExiste(err: unknown): boolean {
  return /ResourceNotFound|NoSuchEntity|not found|does not exist/i.test(err instanceof Error ? err.message : String(err))
}

async function siExiste<T>(ejecutar: EjecutarAws, args: string[]): Promise<T | null> {
  try {
    return await ejecutar<T>(args)
  } catch (err) {
    if (noExiste(err)) return null
    throw err
  }
}

export function esRolDePractica(nombre: string): boolean {
  return nombre.startsWith(PREFIJO_ROL)
}

export async function limpiarPractica(ejecutar: EjecutarAws = aws): Promise<string[]> {
  const borrados: string[] = []
  const roles = new Set<string>()

  const funcion = await siExiste<{ Role?: string }>(ejecutar, [
    'lambda',
    'get-function-configuration',
    '--function-name',
    FUNCION_PRACTICA,
  ])
  const rolDeLaFuncion = funcion?.Role?.split('/').at(-1)
  if (rolDeLaFuncion && esRolDePractica(rolDeLaFuncion)) roles.add(rolDeLaFuncion)

  const encontrados = await ejecutar<{ Roles?: { RoleName: string }[] }>([
    'iam',
    'list-roles',
    '--path-prefix',
    '/service-role/',
  ])
  for (const rol of encontrados.Roles ?? []) {
    if (esRolDePractica(rol.RoleName)) roles.add(rol.RoleName)
  }

  if (funcion) {
    await ejecutar(['lambda', 'delete-function', '--function-name', FUNCION_PRACTICA])
    borrados.push(`Lambda ${FUNCION_PRACTICA}`)
  }

  const log = await siExiste(ejecutar, ['logs', 'delete-log-group', '--log-group-name', LOG_GROUP_PRACTICA])
  if (log) borrados.push(`log group ${LOG_GROUP_PRACTICA}`)

  const tabla = await siExiste(ejecutar, ['dynamodb', 'describe-table', '--table-name', TABLA_PRACTICA])
  if (tabla) {
    await ejecutar(['dynamodb', 'delete-table', '--table-name', TABLA_PRACTICA])
    await ejecutar(['dynamodb', 'wait', 'table-not-exists', '--table-name', TABLA_PRACTICA])
    borrados.push(`tabla ${TABLA_PRACTICA}`)
  }

  for (const rol of roles) {
    const adjuntas = await ejecutar<{ AttachedPolicies?: { PolicyArn?: string }[] }>([
      'iam',
      'list-attached-role-policies',
      '--role-name',
      rol,
    ])
    for (const policy of adjuntas.AttachedPolicies ?? []) {
      if (policy.PolicyArn) {
        await ejecutar(['iam', 'detach-role-policy', '--role-name', rol, '--policy-arn', policy.PolicyArn])
      }
    }

    const inline = await ejecutar<{ PolicyNames?: string[] }>(['iam', 'list-role-policies', '--role-name', rol])
    for (const policy of inline.PolicyNames ?? []) {
      await ejecutar(['iam', 'delete-role-policy', '--role-name', rol, '--policy-name', policy])
    }

    await ejecutar(['iam', 'delete-role', '--role-name', rol])
    borrados.push(`execution role ${rol}`)
  }

  return borrados
}

async function main() {
  const { banderas } = argumentos()
  if (banderas.has('ayuda')) {
    console.log('Uso: pnpm limpiar-practica')
    return
  }

  titulo('Limpiar la práctica manual')
  console.log(`Región: ${CONFIG.region}`)
  console.log(`Lambda: ${FUNCION_PRACTICA}`)
  console.log(`Tabla: ${TABLA_PRACTICA}`)
  console.log(`Log group: ${LOG_GROUP_PRACTICA}`)
  console.log(gris(`También borra los execution roles que encuentre con el prefijo ${PREFIJO_ROL}`))

  if (!banderas.has('si')) {
    const respuesta = await preguntar('Escribe limpiar-practica para confirmar: ')
    if (respuesta !== 'limpiar-practica') {
      console.log('No borré nada.')
      return
    }
  }

  const borrados = await limpiarPractica()
  if (borrados.length === 0) {
    ok('La práctica ya estaba limpia.')
    return
  }
  for (const recurso of borrados) ok(`Borrado: ${recurso}`)
  ok('La práctica quedó limpia. El stack gastos-hormiga no se tocó.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error((err as Error).message)
    process.exitCode = 1
  })
}
