// npm run probar
// Registra un gasto en tu API desplegada y luego pide la lista. Hace lo mismo que
// el curl del workshop, pero sin comillas ni variables que cambian entre sistemas.
//
//   npm run probar                                  → un café de 45
//   npm run probar 28 "galleta del súper" snacks    → tu propio gasto
//   npm run probar 28 "galleta del súper" snacks atajo   → cuenta como gasto del Atajo
//   npm run probar lista                            → solo pide la lista
//   npm run probar negativo                         → manda un monto de -50 (módulo 4)

import { argumentos, falla, gris, ok, titulo } from './lib/consola.ts'
import { pedir } from './lib/http.ts'
import { salidasDelStack, valorDeLaKey } from './lib/stack.ts'

async function main() {
  const { posicionales } = argumentos()
  const soloLista = posicionales[0] === 'lista'
  // "-50" como argumento lo leería npm como una bandera, así que el monto negativo es una palabra.
  const args = posicionales[0] === 'negativo' ? ['-50', 'galleta', 'snacks'] : posicionales
  const [monto = '45', descripcion = 'café de la esquina', categoria = 'cafes', origen = 'curl'] = args

  titulo('Probar tu API')
  const s = await salidasDelStack()
  if (!s.ApiUrl || !s.ApiKeyId) {
    falla('Tu stack no tiene ApiUrl o ApiKeyId', 'Despliega la API del módulo 4 primero: npm run deploy')
    process.exitCode = 1
    return
  }

  if (!soloLista) {
    const key = await valorDeLaKey(s.ApiKeyId)
    const cuerpo = { monto: Number(monto), descripcion, categoria }
    console.log(gris(`POST ${s.ApiUrl}/gastos  ${JSON.stringify(cuerpo)}`))
    const res = await pedir(`${s.ApiUrl}/gastos`, {
      method: 'POST',
      body: cuerpo,
      headers: { 'x-api-key': key, 'x-origen': origen },
    })
    const detalle = `${res.status} ${res.texto.slice(0, 300)}`
    if (res.status === 201) ok(`POST /gastos → ${detalle}`)
    else falla(`POST /gastos → ${detalle}`)
  }

  console.log(gris(`GET ${s.ApiUrl}/gastos`))
  const lista = await pedir(`${s.ApiUrl}/gastos`)
  if (lista.status === 200) ok(`GET /gastos → 200, ${lista.json?.gastos?.length ?? 0} gastos`)
  else falla(`GET /gastos → ${lista.status} ${lista.texto.slice(0, 300)}`)
  for (const g of (lista.json?.gastos ?? []).slice(0, 5)) {
    console.log(`  ${g.fecha}  ${String(g.monto).padStart(8)}  ${g.categoria.padEnd(13)} ${g.descripcion}  ${gris(`(${g.origen})`)}`)
  }
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
