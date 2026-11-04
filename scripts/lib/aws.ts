import { execFile, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const ROOT = path.resolve(import.meta.dirname, '../..')

// Lee el nombre del stack, la Región y el perfil de cdk.json, para que los scripts
// y CDK siempre apunten al mismo lugar: "profile", context.stackName y context.region.
function leerCdkJson(): { stack: string; region: string; perfil: string } {
  const cdk = JSON.parse(readFileSync(path.join(ROOT, 'cdk.json'), 'utf8'))
  return {
    stack: cdk.context?.stackName ?? 'gastos-hormiga',
    region: cdk.context?.region ?? 'us-east-2',
    perfil: cdk.profile ?? 'gastos-hormiga',
  }
}

const cdkJson = leerCdkJson()

export const CONFIG = {
  stack: cdkJson.stack,
  region: cdkJson.region,
  // GASTOS_PERFIL sirve para probar con otro perfil sin editar cdk.json.
  perfil: process.env.GASTOS_PERFIL || cdkJson.perfil,
}

export class ErrorAws extends Error {
  constructor(
    readonly comando: string,
    readonly stderr: string,
  ) {
    super(stderr.trim() || `falló aws ${comando}`)
  }
}

// Corre el AWS CLI con el perfil y la Región del proyecto y regresa el JSON.
// Usamos el CLI (y no el SDK) porque es el que ya tiene tu sesión de aws login.
export async function aws<T = any>(args: string[], opciones: { region?: string } = {}): Promise<T> {
  const completos = [...args, '--profile', CONFIG.perfil, '--region', opciones.region ?? CONFIG.region, '--output', 'json']
  try {
    const { stdout } = await run('aws', completos, { maxBuffer: 10 * 1024 * 1024 })
    return (stdout.trim() ? JSON.parse(stdout) : {}) as T
  } catch (err) {
    const e = err as { stderr?: string; code?: string }
    if (e.code === 'ENOENT') throw new ErrorAws(args.join(' '), 'No encontré el AWS CLI. Instálalo como dice "Antes del evento" y abre una terminal nueva.')
    throw new ErrorAws(args.join(' '), e.stderr ?? String(err))
  }
}

// Corre un comando cualquiera y regresa stdout, o null si no existe o falla.
export async function versionDe(comando: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(comando, args)
    return (stdout || stderr).trim().split('\n')[0]
  } catch {
    return null
  }
}

export function esSesionVencida(err: unknown): boolean {
  const texto = err instanceof Error ? err.message : String(err)
  return /expired|token.*(invalid|refresh)|login|could not be found|Unable to locate credentials/i.test(texto)
}

export function pistaDeSesion(): string {
  return `Corre: aws login --profile ${CONFIG.perfil}`
}

// Corre el CLI de CDK con el mismo node que estás usando y el perfil del proyecto.
// No usamos node_modules/.bin/cdk porque en Windows es un .cmd y necesita un shell.
export function correrCdk(args: string[]): Promise<number> {
  const cdk = path.join(ROOT, 'node_modules', 'aws-cdk', 'bin', 'cdk')
  return new Promise((resolve) => {
    const proceso = spawn(process.execPath, [cdk, ...args, '--profile', CONFIG.perfil], { cwd: ROOT, stdio: 'inherit' })
    proceso.on('error', (err) => {
      console.error(err.message)
      resolve(1)
    })
    proceso.on('close', (codigo) => resolve(codigo ?? 1))
  })
}
