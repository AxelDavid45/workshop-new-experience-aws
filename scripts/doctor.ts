// npm run doctor
// Revisión rápida antes de retomar el workshop o empezar un paso extra.
// No usa shell ni binarios de macOS o Linux: corre igual en Windows.

import {
  AWS_CLI_MINIMO,
  CONFIG,
  NODE_MINIMO,
  NPM_MINIMO,
  aws,
  esSesionVencida,
  esVersionMinima,
  pistaDeSesion,
  versionDe,
  versionDeAwsCli,
  versionDeNpm,
} from './lib/aws.ts'
import { aviso, falla, gris, ok, titulo } from './lib/consola.ts'
import { describirStack } from './lib/stack.ts'

async function main() {
  titulo('npm run doctor')
  let problemas = 0

  const mayor = Number(process.versions.node.split('.')[0])
  if (mayor >= NODE_MINIMO) ok(`Node ${process.versions.node}`)
  else (problemas++, falla(`Node ${process.versions.node}`, `Necesitas Node ${NODE_MINIMO} o superior. Con nvm: nvm install --lts (Windows: nvm install lts)`))

  const npm = await versionDeNpm()
  if (npm && esVersionMinima(npm, NPM_MINIMO)) ok(`npm ${npm}`)
  else (problemas++, falla(`npm ${npm ?? 'no encontrado'}`, `Necesitas npm ${NPM_MINIMO} o superior: npm install -g npm@latest`))

  const git = await versionDe('git', ['--version'])
  if (git) ok(git)
  else (problemas++, falla('No encontré git', 'Instálalo desde https://git-scm.com y abre una terminal nueva'))

  const cli = await versionDeAwsCli()
  if (cli && esVersionMinima(cli, AWS_CLI_MINIMO)) ok(`AWS CLI ${cli}`)
  else if (cli) (problemas++, falla(`AWS CLI ${cli}`, `Necesitas la ${AWS_CLI_MINIMO} o superior para aws login. Vuelve a instalarlo desde la guía`))
  else (problemas++, falla('No encontré el AWS CLI', 'Instálalo como dice "Antes del evento" y abre una terminal nueva'))

  try {
    await aws(['sts', 'get-caller-identity'])
    ok(`Sesión activa con el perfil ${CONFIG.perfil}`)
  } catch (err) {
    problemas++
    falla(`Sin sesión para el perfil ${CONFIG.perfil}`, esSesionVencida(err) ? pistaDeSesion() : (err as Error).message)
    console.log(gris('\nSin sesión no puedo revisar lo demás.'))
    process.exitCode = 1
    return
  }

  try {
    await aws(['cloudformation', 'describe-stacks', '--stack-name', 'CDKToolkit'])
    ok(`CDK listo en ${CONFIG.region} (bootstrap hecho)`)
  } catch {
    aviso(`Todavía no hiciste el bootstrap de CDK en ${CONFIG.region}`, 'Se hace una vez, en el módulo 4: npm run bootstrap')
  }

  try {
    const { estado, salidas } = await describirStack()
    const listo = /_COMPLETE$/.test(estado) && !/ROLLBACK/.test(estado)
    if (listo) ok(`Stack ${CONFIG.stack} en ${CONFIG.region}: ${estado}`)
    else (problemas++, falla(`Stack ${CONFIG.stack}: ${estado}`, 'Revisa los eventos en la consola de CloudFormation'))
    const esperadas = ['ApiUrl', 'ApiKeyId', 'TablaGastos']
    const faltan = esperadas.filter((k) => !salidas[k])
    if (faltan.length === 0) ok(`Outputs: ${Object.keys(salidas).join(', ')}`)
    else (problemas++, falla(`Faltan outputs: ${faltan.join(', ')}`))
  } catch (err) {
    problemas++
    falla(`No encontré el stack ${CONFIG.stack} en ${CONFIG.region}`, 'Si es la primera vez, despliégalo con npm run deploy (módulo 4)')
  }

  try {
    const plan = await aws<{
      accountPlanType: string
      accountPlanStatus: string
      accountPlanRemainingCredits?: { amount: number; unit: string }
      accountPlanExpirationDate?: string
    }>(['freetier', 'get-account-plan-state'], { region: 'us-east-1' })
    if (plan.accountPlanType === 'PAID') {
      ok('Estás en el plan de pago. Revisa tu límite de gasto en AWS Settings > Billing')
    } else {
      const expira = plan.accountPlanExpirationDate ? new Date(plan.accountPlanExpirationDate) : null
      const dias = expira ? Math.ceil((expira.getTime() - Date.now()) / 86_400_000) : null
      const creditos = plan.accountPlanRemainingCredits
      const texto = `AWS Free Tier: ${dias ?? '?'} días restantes, ${creditos ? `${creditos.amount} ${creditos.unit}` : '?'} de créditos`
      if (dias !== null && dias < 30) aviso(texto, 'Si quieres conservar tu app, pasa al plan de pago antes de que termine y ponle un límite de gasto')
      else ok(texto)
    }
  } catch {
    aviso('No pude leer el estado de tu plan', 'Revísalo en AWS Settings')
  }

  console.log(problemas === 0 ? '\nTodo bien.' : `\n${problemas} cosa(s) por revisar.`)
  if (problemas > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error((err as Error).message)
  process.exitCode = 1
})
