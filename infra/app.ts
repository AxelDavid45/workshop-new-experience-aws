// Punto de entrada de CDK. cdk.json lo ejecuta con: node --import tsx infra/app.ts
// El nombre del stack y la Región salen de "context" en cdk.json.

import { App } from 'aws-cdk-lib'
import { GastosStack } from './gastos-stack.ts'

const app = new App()
const stackName = app.node.tryGetContext('stackName') ?? 'gastos-hormiga'
const region = app.node.tryGetContext('region') ?? 'us-east-2'

new GastosStack(app, stackName, {
  stackName,
  // CDK_DEFAULT_ACCOUNT lo llena el CLI con la cuenta de tu perfil.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region },
})
