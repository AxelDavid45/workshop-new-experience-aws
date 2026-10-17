import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const ROOT = path.resolve(import.meta.dirname, '../..')

// Lee stack_name, region y profile de samconfig.toml, para que los scripts
// y SAM siempre apunten al mismo lugar. Solo se lee [default.global.parameters].
function leerSamconfig(): { stack: string; region: string; perfil: string } {
  const texto = readFileSync(path.join(ROOT, 'samconfig.toml'), 'utf8')
  const seccion = texto.split('[default.global.parameters]')[1]?.split(/\n\[/)[0] ?? ''
  const valor = (clave: string, porDefecto: string) =>
    seccion.match(new RegExp(`^${clave}\\s*=\\s*"([^"]+)"`, 'm'))?.[1] ?? porDefecto
  return {
    stack: valor('stack_name', 'gastos-hormiga'),
    region: valor('region', 'us-east-2'),
    perfil: valor('profile', 'gastos-hormiga'),
  }
}

const samconfig = leerSamconfig()

export const CONFIG = {
  stack: samconfig.stack,
  region: samconfig.region,
  // GASTOS_PERFIL sirve para probar con otro perfil sin editar samconfig.toml.
  perfil: process.env.GASTOS_PERFIL || samconfig.perfil,
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
    if (e.code === 'ENOENT') throw new ErrorAws(args.join(' '), 'No encontré el AWS CLI. Lo instala el Agent Toolkit en el módulo 3.')
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
