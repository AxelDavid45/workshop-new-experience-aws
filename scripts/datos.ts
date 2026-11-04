// npm run datos imprime la URL y la API key después del recorrido manual por consola.

import { argumentos, gris, titulo } from './lib/consola.ts'
import { salidasDelStack, valorDeLaKey } from './lib/stack.ts'

async function main() {
  const { banderas, posicionales } = argumentos()
  const s = await salidasDelStack()
  titulo('Tu app de gastos hormiga')
  console.log(`URL del POST:  ${s.ApiUrl}/gastos`)
  if (s.ApiKeyId) {
    const valor = await valorDeLaKey(s.ApiKeyId)
    // La key no se imprime completa a menos que la pidas, por si estás proyectando tu pantalla.
    // "mostrar-key" va sin guiones porque npm interpreta los --flags sueltos como suyos.
    const completa = banderas.has('mostrar-key') || posicionales.includes('mostrar-key')
    const mostrar = completa ? valor : `${valor.slice(0, 4)}${'•'.repeat(12)} ${gris('(npm run datos mostrar-key para verla completa)')}`
    console.log(`API key:       ${mostrar}`)
  }
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
