// pnpm crear-usuario
// Paso extra A (Cognito). No hay registro abierto: tu usuario lo creas tú con
// tus credenciales de AWS. Cognito te manda una contraseña temporal al correo.

import { aws } from './lib/aws.ts'
import { falla, ok, preguntar, titulo } from './lib/consola.ts'
import { salidasDelStack } from './lib/stack.ts'

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function main() {
  titulo('Crear tu usuario de Cognito')
  const s = await salidasDelStack()
  if (!s.UserPoolId) {
    falla('Tu stack no tiene un User Pool', 'Esto es del paso extra B. Empieza con git switch extra-presupuestos y sigue la guía')
    process.exitCode = 1
    return
  }
  const correo = process.argv[2] ?? (await preguntar('Tu correo: '))
  if (!CORREO.test(correo)) {
    falla('Ese correo no parece válido')
    process.exitCode = 1
    return
  }
  await aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    s.UserPoolId,
    '--username',
    correo,
    '--user-attributes',
    `Name=email,Value=${correo}`,
    'Name=email_verified,Value=true',
    '--desired-delivery-mediums',
    'EMAIL',
  ])
  ok(`Usuario creado. Revisa ${correo}: te llega una contraseña temporal que cambias al entrar a tu página.`)
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
