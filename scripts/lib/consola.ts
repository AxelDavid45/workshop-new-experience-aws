// Salida de consola sin dependencias. Respeta NO_COLOR y terminales sin color.
const conColor = process.stdout.isTTY && !process.env.NO_COLOR

const pinta = (codigo: string) => (texto: string) => (conColor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto)

export const verde = pinta('32')
export const rojo = pinta('31')
export const amarillo = pinta('33')
export const gris = pinta('90')
export const negritas = pinta('1')

export function ok(texto: string) {
  console.log(`${verde('✔')} ${texto}`)
}
export function falla(texto: string, pista?: string) {
  console.log(`${rojo('✘')} ${texto}`)
  if (pista) console.log(`  ${gris('→')} ${pista}`)
}
export function aviso(texto: string, pista?: string) {
  console.log(`${amarillo('!')} ${texto}`)
  if (pista) console.log(`  ${gris('→')} ${pista}`)
}
export function titulo(texto: string) {
  console.log(`\n${negritas(texto)}`)
}

// Lee los argumentos tipo `--solo-extras` y regresa los posicionales aparte.
export function argumentos(argv = process.argv.slice(2)) {
  const banderas = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)))
  const posicionales = argv.filter((a) => !a.startsWith('--'))
  return { banderas, posicionales }
}

export async function preguntar(pregunta: string): Promise<string> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(pregunta)).trim()
  } finally {
    rl.close()
  }
}
