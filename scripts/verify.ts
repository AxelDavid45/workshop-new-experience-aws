// pnpm verify N
//
// Revisa el contrato de tu app por comportamiento, no por código: le pega a TU
// API desplegada y confirma que responda lo que pide la spec
// (.kiro/specs/gastos-hormiga/requirements.md). Si sale
// verde, terminaste, aunque tu Kiro haya escrito distinto que el del vecino.
//
// Los gastos y presupuestos de prueba que crea se borran al terminar.

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { CONFIG, ROOT, aws, esSesionVencida, pistaDeSesion, versionDe } from './lib/aws.ts'
import { argumentos, aviso, falla, gris, ok, preguntar, titulo, verde } from './lib/consola.ts'
import { pedir } from './lib/http.ts'
import { describirStack, valorDeLaKey, type Salidas } from './lib/stack.ts'

const run = promisify(execFile)

class Falla extends Error {
  constructor(
    mensaje: string,
    readonly pista?: string,
  ) {
    super(mensaje)
  }
}

interface Prueba {
  nombre: string
  correr: () => Promise<string | void> // regresa un detalle opcional para mostrar
  suave?: boolean // si falla solo avisa, no tumba el checkpoint
}

function esperar(condicion: boolean, mensaje: string, pista?: string): asserts condicion {
  if (!condicion) throw new Falla(mensaje, pista)
}

// ---------- Contexto compartido entre pruebas ----------

let salidasCache: Salidas | null = null
async function salidas(): Promise<Salidas> {
  if (salidasCache) return salidasCache
  try {
    const stack = await describirStack()
    salidasCache = stack.salidas
    return salidasCache
  } catch (err) {
    if (esSesionVencida(err)) throw new Falla('Tu sesión de AWS venció o no existe', pistaDeSesion())
    if (/does not exist/.test(String(err))) {
      throw new Falla(`No encontré el stack ${CONFIG.stack} en ${CONFIG.region}`, 'Despliégalo con sam build y sam deploy (módulo 4)')
    }
    throw new Falla(String((err as Error).message ?? err))
  }
}

async function apiUrl(): Promise<string> {
  const s = await salidas()
  esperar(!!s.ApiUrl, 'El stack no tiene el output ApiUrl', 'Revisa la sección Outputs de template.yaml')
  return s.ApiUrl
}

let keyCache: string | null = null
async function apiKey(): Promise<string> {
  if (keyCache) return keyCache
  const s = await salidas()
  esperar(!!s.ApiKeyId, 'El stack no tiene el output ApiKeyId')
  keyCache = await valorDeLaKey(s.ApiKeyId)
  return keyCache
}

// Gastos que creó el verify y que hay que borrar al final.
const porBorrar: { pk: string; sk: string }[] = []

async function borrarPendientes() {
  if (porBorrar.length === 0) return
  const tabla = salidasCache?.TablaGastos ?? `${CONFIG.stack}-gastos`
  for (const llave of porBorrar.splice(0)) {
    try {
      await aws(['dynamodb', 'delete-item', '--table-name', tabla, '--key', JSON.stringify({ pk: { S: llave.pk }, sk: { S: llave.sk } })])
    } catch {
      aviso(`No pude borrar el registro de prueba ${llave.sk}`, 'Bórralo a mano en DynamoDB > Explore items')
    }
  }
}

async function postGasto(body: unknown, headers: Record<string, string> = {}) {
  const res = await pedir(`${await apiUrl()}/gastos`, { method: 'POST', body, headers: { 'x-origen': 'verify', ...headers } })
  if (res.status === 201 && res.json?.id && res.json?.fecha) {
    porBorrar.push({ pk: 'GASTOS', sk: `GASTO#${res.json.fecha}#${res.json.id}` })
  }
  return res
}

async function correrTest(archivo: string, filtro?: string) {
  const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest')
  const args = ['run', archivo, ...(filtro ? ['-t', filtro] : []), '--reporter=verbose']
  try {
    await run(bin, args, { cwd: ROOT, shell: process.platform === 'win32', env: { ...process.env, NO_COLOR: '1' } })
  } catch (err) {
    const e = err as { stdout?: string }
    const enRojo = (e.stdout ?? "").match(/^\s*[×✗x] (.+?)(?:\s+\d+ms)?$/m)?.[1]?.split(" > ").at(-1)?.trim()
    throw new Falla(`Sigue en rojo${enRojo ? `: "${enRojo}"` : ''}`, `Corre pnpm test ${archivo} para ver el detalle`)
  }
}

// ---------- Pruebas por módulo ----------

const gastoValido = { monto: 1, descripcion: 'prueba de pnpm verify', categoria: 'otros' }

const pruebasDeSesion: Prueba[] = [
  {
    nombre: 'Tu sesión de AWS está activa',
    correr: async () => {
      try {
        await aws(['sts', 'get-caller-identity'])
      } catch (err) {
        throw new Falla('No hay sesión activa para el perfil ' + CONFIG.perfil, pistaDeSesion())
      }
      return `perfil ${CONFIG.perfil}`
    },
  },
]

const MODULOS: Record<string, { titulo: string; pruebas: Prueba[] }> = {
  '0': {
    titulo: 'Arranque',
    pruebas: [
      {
        nombre: 'Node.js 22 o superior',
        correr: async () => {
          const mayor = Number(process.versions.node.split('.')[0])
          esperar(mayor >= 22, `Tienes Node ${process.versions.node}`, 'Instala la versión LTS desde https://nodejs.org')
          return `v${process.versions.node}`
        },
      },
      {
        nombre: 'Git instalado',
        correr: async () => {
          const v = await versionDe('git', ['--version'])
          esperar(!!v, 'No encontré git', 'Instálalo desde https://git-scm.com')
          return v
        },
      },
      {
        nombre: 'AWS SAM CLI instalado',
        correr: async () => {
          const v = await versionDe('sam', ['--version'])
          esperar(!!v, 'No encontré sam', 'Sigue la guía de instalación del prework')
          return v
        },
      },
      {
        nombre: 'AWS CLI (lo instala el Agent Toolkit en el módulo 3)',
        suave: true,
        correr: async () => {
          const v = await versionDe('aws', ['--version'])
          esperar(!!v, 'Todavía no tienes el AWS CLI', 'No pasa nada, se instala en el módulo 3')
          return v.split(' ')[0]
        },
      },
    ],
  },
  '3': {
    titulo: 'Kiro y AWS',
    pruebas: [
      ...pruebasDeSesion,
      {
        nombre: `La Región del perfil es ${CONFIG.region}`,
        correr: async () => {
          const { stdout } = await run('aws', ['configure', 'get', 'region', '--profile', CONFIG.perfil]).catch(() => ({ stdout: '' }))
          const region = stdout.trim()
          esperar(
            region === CONFIG.region,
            `Tu perfil dice "${region || 'sin Región'}"`,
            `Confirma tu Región en AWS Settings > Overview > Additional Info. Si no es ${CONFIG.region}, cámbiala en samconfig.toml`,
          )
          return region
        },
      },
      {
        nombre: 'Tienes al menos un budget',
        correr: async () => {
          const { Account } = await aws<{ Account: string }>(['sts', 'get-caller-identity'])
          const r = await aws<{ Budgets?: { BudgetName: string }[] }>(['budgets', 'describe-budgets', '--account-id', Account], { region: 'us-east-1' })
          const nombres = (r.Budgets ?? []).map((b) => b.BudgetName)
          esperar(nombres.length > 0, 'No encontré ningún budget', 'Crea el Zero spend budget desde la actividad del módulo 2')
          return nombres.join(', ')
        },
      },
      {
        nombre: 'Actividad de Budgets completada',
        suave: true,
        correr: async () => {
          const r = await aws<{ activities: { title: string; status: string; reward?: { credit?: { amount: number } } }[] }>(
            ['freetier', 'list-account-activities'],
            { region: 'us-east-1' },
          )
          const buscadas = [/budget/i]
          const lineas = r.activities.map((a) => `${a.status === 'COMPLETED' ? verde('✔') : gris('·')} ${a.title} ${gris(`(${a.status})`)}`)
          console.log(lineas.map((l) => `    ${l}`).join('\n'))
          const faltan = r.activities.filter((a) => buscadas.some((re) => re.test(a.title)) && a.status !== 'COMPLETED')
          esperar(
            faltan.length === 0,
            faltan.length === 1 ? `Te falta 1 actividad del módulo 2: ${faltan[0].title}` : `Te faltan ${faltan.length} actividades del módulo 2`,
            'A veces tarda en actualizarse. Si ya las hiciste, vuelve a correrlo en unos minutos',
          )
        },
      },
    ],
  },
  '4': {
    titulo: 'Tu API',
    pruebas: [
      {
        nombre: 'Los tests de tests/gastos.test.ts pasan',
        correr: () => correrTest('tests/gastos.test.ts'),
      },
      ...pruebasDeSesion,
      { nombre: 'El stack existe y tiene la URL de tu API', correr: apiUrl },
      {
        nombre: 'POST /gastos sin API key responde 403',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/gastos`, { method: 'POST', body: gastoValido })
          esperar(res.status === 403, `Respondió ${res.status}`, 'En template.yaml el evento del POST necesita Auth: ApiKeyRequired: true')
        },
      },
      {
        nombre: 'POST /gastos con API key responde 201',
        correr: async () => {
          const res = await postGasto(gastoValido, { 'x-api-key': await apiKey() })
          esperar(
            res.status !== 501,
            'Respondió 501: tu Lambda desplegada todavía es la versión vacía',
            'Haz la tarea 1 de la spec con Kiro y vuelve a desplegar (módulo 4)',
          )
          esperar(res.status === 201, `Respondió ${res.status}: ${res.texto.slice(0, 120)}`, 'Revisa los logs con sam logs --stack-name gastos-hormiga --tail')
          esperar(!!res.json?.id, 'La respuesta no trae el id del gasto')
        },
      },
      {
        nombre: 'GET /gastos responde 200 y trae el gasto que acabamos de crear',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/gastos`)
          esperar(res.status === 200, `Respondió ${res.status}`)
          esperar(Array.isArray(res.json?.gastos), 'La respuesta no trae la lista "gastos"')
          const ultimo = porBorrar.at(-1)?.sk.split('#').at(-1)
          esperar(res.json.gastos.some((g: { id: string }) => g.id === ultimo), 'El gasto nuevo no aparece en el GET')
          return `${res.json.gastos.length} gastos`
        },
      },
      {
        nombre: 'POST /gastos sin monto responde 400',
        correr: async () => {
          const res = await postGasto({ descripcion: 'sin monto', categoria: 'otros' }, { 'x-api-key': await apiKey() })
          esperar(res.status === 400, `Respondió ${res.status}`)
        },
      },
      {
        nombre: 'Tu API desplegada rechaza montos negativos',
        correr: async () => {
          const res = await postGasto({ ...gastoValido, monto: -50 }, { 'x-api-key': await apiKey() })
          esperar(
            res.status === 400,
            `Respondió ${res.status}, tu API todavía acepta montos negativos`,
            'El test local ya pasa pero falta subirlo. ¿Está corriendo pnpm sync?',
          )
        },
      },
    ],
  },
  '5': {
    titulo: 'En tu teléfono',
    pruebas: [
      ...pruebasDeSesion,
      {
        nombre: 'Entró al menos un gasto desde el Atajo',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/gastos`)
          esperar(res.status === 200, `GET /gastos respondió ${res.status}`)
          const delAtajo = (res.json?.gastos ?? []).filter((g: { origen: string }) => g.origen === 'atajo')
          esperar(delAtajo.length > 0, 'No veo gastos con origen "atajo"', 'Revisa que tu Atajo mande el header x-origen: atajo')
          return `${delAtajo.length} gastos desde el Atajo`
        },
      },
    ],
  },
  '6': {
    titulo: 'Tu página de gastos',
    pruebas: [
      ...pruebasDeSesion,
      {
        nombre: 'El stack tiene los outputs de la página',
        correr: async () => {
          const s = await salidas()
          const faltan = ['PaginaUrl', 'PaginaBucket', 'DistribucionId'].filter((k) => !s[k])
          esperar(faltan.length === 0, `Faltan los outputs ${faltan.join(', ')}`, 'La tarea 2 de la spec dice cómo se llaman. ¿Ya reanudaste pnpm sync?')
          return s.PaginaUrl
        },
      },
      {
        nombre: 'Tu página responde por CloudFront',
        correr: async () => {
          const s = await salidas()
          const res = await pedir(s.PaginaUrl!)
          esperar(res.status === 200, `Respondió ${res.status}`, 'CloudFront tarda unos minutos la primera vez. ¿Ya corriste pnpm subir-pagina?')
          esperar(res.texto.includes('Gastos hormiga'), 'La página no parece ser la de web/', 'Corre pnpm subir-pagina')
        },
      },
      {
        nombre: 'La página lleva el header X-Robots-Tag: noindex',
        correr: async () => {
          const res = await pedir((await salidas()).PaginaUrl!)
          const valor = res.headers.get('x-robots-tag') ?? ''
          esperar(/noindex/i.test(valor), 'No veo el header X-Robots-Tag', 'Va en la response headers policy de la distribución')
        },
      },
      {
        nombre: 'La página sabe cuál es tu API',
        correr: async () => {
          const s = await salidas()
          const res = await pedir(new URL('config.js', s.PaginaUrl!.endsWith('/') ? s.PaginaUrl! : s.PaginaUrl + '/').toString())
          esperar(res.status === 200 && res.texto.includes(s.ApiUrl!), 'config.js no apunta a tu API', 'Corre pnpm subir-pagina')
        },
      },
      {
        nombre: 'El bucket es privado (S3 directo responde 403)',
        correr: async () => {
          const s = await salidas()
          const bloqueo = await aws<{ PublicAccessBlockConfiguration: Record<string, boolean> }>([
            's3api',
            'get-public-access-block',
            '--bucket',
            s.PaginaBucket!,
          ]).catch(() => null)
          const todo = bloqueo && Object.values(bloqueo.PublicAccessBlockConfiguration).every(Boolean)
          esperar(!!todo, 'El bucket no tiene activado Block Public Access completo', 'Revisa PublicAccessBlockConfiguration en template.yaml')
          const directo = await pedir(`https://${s.PaginaBucket}.s3.${CONFIG.region}.amazonaws.com/index.html`)
          esperar(directo.status === 403, `S3 directo respondió ${directo.status}`, 'Solo CloudFront debería poder leer el bucket')
        },
      },
    ],
  },
  presupuestos: {
    titulo: 'Paso extra A: presupuestos por categoría',
    pruebas: [
      {
        nombre: 'Los tests de zona horaria pasan',
        correr: () => correrTest('tests/periodo.test.ts'),
      },
      ...pruebasDeSesion,
      {
        nombre: 'GET /presupuestos responde 200 con una lista',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/presupuestos`)
          esperar(res.status === 200, `Respondió ${res.status}`, 'Revisa que el evento del GET esté en template.yaml y que pnpm sync esté corriendo')
          esperar(Array.isArray(res.json?.presupuestos), 'La respuesta no trae la lista "presupuestos"', 'El formato está en el requisito 4 de la spec')
        },
      },
      {
        nombre: 'PUT /presupuestos con una categoría que no existe responde 400',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/presupuestos/dulces`, { method: 'PUT', body: { tope: 50, periodo: 'semana' } })
          esperar(res.status === 400, `Respondió ${res.status}`)
        },
      },
      {
        nombre: 'PUT /presupuestos/otros guarda y el GET regresa tope, gastado y reinicio',
        correr: async () => {
          const url = await apiUrl()
          const antes = await pedir(`${url}/presupuestos`)
          const previo = (antes.json?.presupuestos ?? []).find((p: { categoria: string }) => p.categoria === 'otros')
          try {
            const put = await pedir(`${url}/presupuestos/otros`, { method: 'PUT', body: { tope: 123, periodo: 'mes' } })
            esperar(put.status === 200, `El PUT respondió ${put.status}: ${put.texto.slice(0, 120)}`)
            const res = await pedir(`${url}/presupuestos`)
            const p = (res.json?.presupuestos ?? []).find((x: { categoria: string }) => x.categoria === 'otros')
            esperar(!!p, 'El GET no regresa el presupuesto de "otros"')
            esperar(p.tope === 123 && p.periodo === 'mes', `El GET regresa tope ${p.tope} y periodo ${p.periodo}`)
            esperar(typeof p.gastado === 'number', 'Falta "gastado" (número)')
            esperar(!Number.isNaN(Date.parse(p.reiniciaEl)), 'Falta "reiniciaEl" (fecha ISO)')
          } finally {
            if (previo) {
              await pedir(`${url}/presupuestos/otros`, { method: 'PUT', body: { tope: previo.tope, periodo: previo.periodo } })
            } else {
              porBorrar.push({ pk: 'PRESUPUESTOS', sk: 'CATEGORIA#otros' })
            }
          }
        },
      },
    ],
  },
  cognito: {
    titulo: 'Paso extra A: login con Cognito',
    pruebas: [
      ...pruebasDeSesion,
      {
        nombre: 'GET /gastos sin token responde 401',
        correr: async () => {
          const res = await pedir(`${await apiUrl()}/gastos`)
          esperar(res.status === 401, `Respondió ${res.status}`, 'El GET tiene que usar el autorizador de Cognito')
        },
      },
      {
        nombre: 'GET /gastos con token responde 200',
        correr: async () => {
          const s = await salidas()
          esperar(!!s.UserPoolClientId, 'Falta el output UserPoolClientId')
          const usuario = process.env.GASTOS_USUARIO || (await preguntar('  Correo de tu usuario de Cognito: '))
          const contrasena = process.env.GASTOS_CONTRASENA || (await preguntar('  Contraseña: '))
          const auth = await aws<{ AuthenticationResult?: { IdToken: string } }>([
            'cognito-idp',
            'initiate-auth',
            '--auth-flow',
            'USER_PASSWORD_AUTH',
            '--client-id',
            s.UserPoolClientId!,
            '--auth-parameters',
            `USERNAME=${usuario},PASSWORD=${contrasena}`,
          ]).catch((err) => {
            throw new Falla('No pude iniciar sesión con ese usuario', String(err.message).split('\n')[0])
          })
          const token = auth.AuthenticationResult?.IdToken
          esperar(!!token, 'Cognito pidió otro paso (¿cambiaste la contraseña temporal?)', 'Entra una vez a tu página y cambia la contraseña')
          const res = await pedir(`${await apiUrl()}/gastos`, { headers: { authorization: token } })
          esperar(res.status === 200, `Respondió ${res.status}`)
        },
      },
      {
        nombre: 'El POST con API key sigue respondiendo 201 (tu Atajo no se rompe)',
        correr: async () => {
          const res = await postGasto(gastoValido, { 'x-api-key': await apiKey() })
          esperar(res.status === 201, `Respondió ${res.status}`)
        },
      },
    ],
  },
}

// ---------- Main ----------

async function main() {
  const { posicionales } = argumentos()
  const modulo = posicionales[0]

  if (!modulo || !MODULOS[modulo]) {
    console.log(`Uso: pnpm verify <${Object.keys(MODULOS).join('|')}>`)
    console.log(gris('Los módulos 1 y 2 se revisan con pnpm verify 3.'))
    process.exitCode = 1
    return
  }

  const { titulo: nombre, pruebas } = MODULOS[modulo]
  titulo(`Checkpoint ${modulo}: ${nombre}`)

  let primeraFalla: string | undefined
  for (const prueba of pruebas) {
    try {
      const detalle = await prueba.correr()
      ok(`${prueba.nombre}${detalle ? gris(` (${detalle})`) : ''}`)
    } catch (err) {
      const e = err instanceof Falla ? err : new Falla((err as Error).message ?? String(err))
      if (prueba.suave) {
        aviso(`${prueba.nombre}: ${e.message}`, e.pista)
        continue
      }
      falla(`${prueba.nombre}: ${e.message}`, e.pista)
      primeraFalla = prueba.nombre
      break
    }
  }

  await borrarPendientes()

  if (primeraFalla) {
    console.log(`\nTodavía no. Revisa el "Si te atoraste" del módulo ${modulo} en el sitio.`)
    process.exitCode = 1
  } else {
    console.log(`\n${verde('✅ Checkpoint ' + modulo + ' completo.')}`)
  }
}

main().catch(async (err) => {
  await borrarPendientes()
  console.error(err)
  process.exitCode = 1
})
