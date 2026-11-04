import { exec, execFile, spawn } from 'node:child_process'
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

// ---------- Versiones mínimas ----------

export const NODE_MINIMO = 22
export const NPM_MINIMO = '11.10.0' // desde aquí existe min-release-age en .npmrc
export const AWS_CLI_MINIMO = '2.32.0' // desde aquí existe aws login

// Compara "2.36.42" contra "2.32.0": true si la primera es igual o más nueva.
export function esVersionMinima(version: string, minima: string): boolean {
  const a = version.split('.').map((n) => parseInt(n, 10) || 0)
  const m = minima.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (m[i] ?? 0)) return (a[i] ?? 0) > (m[i] ?? 0)
  }
  return true
}

// npm avisa su versión a los scripts en npm_config_user_agent ("npm/12.2.1 node/v26.13.0 ...").
// Si no corriste el script con npm, la pedimos con un shell: en Windows npm es npm.cmd.
export async function versionDeNpm(): Promise<string | null> {
  const delAgente = process.env.npm_config_user_agent?.match(/^npm\/(\d+\.\d+\.\d+)/)?.[1]
  if (delAgente) return delAgente
  try {
    const { stdout } = await promisify(exec)('npm --version')
    return stdout.trim().split('\n')[0] || null
  } catch {
    return null
  }
}

export async function versionDeAwsCli(): Promise<string | null> {
  const linea = await versionDe('aws', ['--version'])
  return linea?.match(/aws-cli\/(\d+\.\d+\.\d+)/)?.[1] ?? null
}
