// Revisa lo que `design.md` dice que no se negocia, sobre la plantilla que CDK genera.
// No necesita credenciales de AWS ni empaqueta las Lambdas.

import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { GastosStack } from '../infra/gastos-stack.ts'

const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })
const stack = new GastosStack(app, 'gastos-hormiga', {
  stackName: 'gastos-hormiga',
  env: { account: '123456789012', region: 'us-east-2' },
})
const template = Template.fromStack(stack)

describe('infraestructura', () => {
  it('GastosTable conserva su logical ID, nombre, llaves y política de borrado', () => {
    template.hasResource('AWS::DynamoDB::Table', {
      Properties: {
        TableName: 'gastos-hormiga-gastos',
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
      },
      DeletionPolicy: 'Delete',
    })
    expect(Object.keys(template.findResources('AWS::DynamoDB::Table'))).toEqual(['GastosTable'])
  })

  it('solo el POST pide API key', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'POST', ApiKeyRequired: true })
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ApiKeyRequired: Match.absent(),
      AuthorizationType: 'NONE',
    })
  })

  it('las Lambdas usan Node 24 en arm64 y cada una tiene su log group de 14 días', () => {
    const funciones = template.findResources('AWS::Lambda::Function')
    expect(Object.keys(funciones)).toHaveLength(2)
    template.allResourcesProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
    })
    template.resourcePropertiesCountIs('AWS::Logs::LogGroup', { RetentionInDays: 14 }, 2)
    template.hasResource('AWS::Logs::LogGroup', { DeletionPolicy: 'Delete' })
  })

  it('cada Lambda tiene solo su permiso sobre GastosTable, sin comodines', () => {
    const politicas = Object.values(template.findResources('AWS::IAM::Policy')).map(
      (p) => p.Properties.PolicyDocument.Statement,
    )
    const acciones = politicas.map((s) => s.map((x: { Action: string }) => x.Action)).flat().sort()
    expect(acciones).toEqual(['dynamodb:PutItem', 'dynamodb:Query'])
    for (const statements of politicas) {
      for (const x of statements) expect(x.Resource).toEqual({ 'Fn::GetAtt': ['GastosTable', 'Arn'] })
    }
  })

  it('el stage v1 y el usage plan traen los límites del diseño', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'v1',
      MethodSettings: [Match.objectLike({ ThrottlingRateLimit: 5, ThrottlingBurstLimit: 5 })],
    })
    template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
      Throttle: { RateLimit: 2, BurstLimit: 4 },
      Quota: { Limit: 500, Period: 'DAY' },
    })
  })

  it('publica los tres outputs que usan los checkpoints', () => {
    expect(Object.keys(template.toJSON().Outputs).sort()).toEqual(['ApiKeyId', 'ApiUrl', 'TablaGastos'])
  })

  it('todo recurso con tags lleva workshop=gastos-hormiga', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', { Tags: [{ Key: 'workshop', Value: 'gastos-hormiga' }] })
    template.hasResourceProperties('AWS::Lambda::Function', { Tags: [{ Key: 'workshop', Value: 'gastos-hormiga' }] })
  })
})
