// pnpm datos
// Imprime lo que necesitas para configurar el Atajo: la URL de tu API y el valor
// de tu API key. En el módulo 4 la copias desde la consola a propósito, esto es
// el atajo para cuando ya sabes dónde está.

import { argumentos, gris, titulo } from './lib/consola.ts'
import { salidasDelStack, valorDeLaKey } from './lib/stack.ts'

async function main() {
  const { banderas } = argumentos()
  const s = await salidasDelStack()
  titulo('Tu app de gastos hormiga')
  console.log(`URL del POST:  ${s.ApiUrl}/gastos`)
  if (s.ApiKeyId) {
    const valor = await valorDeLaKey(s.ApiKeyId)
    // La key no se imprime completa a menos que la pidas, por si estás proyectando tu pantalla.
    const mostrar = banderas.has('mostrar-key') ? valor : `${valor.slice(0, 4)}${'•'.repeat(12)} ${gris('(usa --mostrar-key para verla completa)')}`
    console.log(`API key:       ${mostrar}`)
  }
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
