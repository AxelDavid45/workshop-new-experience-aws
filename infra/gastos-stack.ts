// La infraestructura del backend, escrita con AWS CDK en TypeScript.
// `npm run synth` la convierte en una plantilla de CloudFormation y
// `npm run deploy` la crea en tu proyecto de AWS.

import { fileURLToPath } from 'node:url'
import { CfnOutput, CfnParameter, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib'
import { LambdaIntegration, Period, RestApi } from 'aws-cdk-lib/aws-apigateway'
import { AttributeType, BillingMode, CfnTable, Table } from 'aws-cdk-lib/aws-dynamodb'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

const ETAPA = 'v1'
const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url))

export class GastosStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    Tags.of(this).add('workshop', 'gastos-hormiga')

    // Súbele uno para rotar la API key (lo hace npm run rotar-key).
    const versionKey = new CfnParameter(this, 'VersionKey', {
      type: 'String',
      default: '1',
      description: 'Súbele uno para rotar la API key (lo hace npm run rotar-key)',
    })

    // La tabla donde viven tus gastos. No se toca: si cambia, se borran tus gastos.
    const tabla = new Table(this, 'GastosTable', {
      tableName: `${this.stackName}-gastos`,
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      // CDK conserva las tablas por default. Aquí queremos que npm run limpiar la borre.
      removalPolicy: RemovalPolicy.DESTROY,
    })
    // CDK arma el logical ID con un hash. Lo fijamos para que sea GastosTable en todas las ramas.
    ;(tabla.node.defaultChild as CfnTable).overrideLogicalId('GastosTable')

    // Cada Lambda tiene su log group con el mismo nombre: dura 14 días y se borra con el stack.
    const crearFuncion = (id: string, nombre: string, handler: string) =>
      new NodejsFunction(this, id, {
        functionName: nombre,
        entry: ruta(`../src/handlers/${handler}.ts`),
        depsLockFilePath: ruta('../package-lock.json'),
        handler: 'handler',
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { TABLE_NAME: tabla.tableName },
        logGroup: new LogGroup(this, `${id}Logs`, {
          logGroupName: `/aws/lambda/${nombre}`,
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        // esbuild empaqueta el TypeScript. @aws-sdk/* ya viene en el runtime de Lambda.
        bundling: { format: OutputFormat.ESM, target: 'es2022', externalModules: ['@aws-sdk/*'] },
      })

    // POST /gastos: registra un gasto. Solo puede escribir en la tabla.
    const registrar = crearFuncion('RegistrarGastoFunction', `${this.stackName}-registrar`, 'registrar')
    registrar.addToRolePolicy(new PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [tabla.tableArn] }))

    // GET /gastos: lista tus gastos. Solo puede leer la tabla.
    const listar = crearFuncion('ListarGastosFunction', `${this.stackName}-listar`, 'listar')
    listar.addToRolePolicy(new PolicyStatement({ actions: ['dynamodb:Query'], resources: [tabla.tableArn] }))

    // REST API (no HTTP API): los usage plans y las API keys solo existen en REST.
    const api = new RestApi(this, 'GastosApi', {
      restApiName: `${this.stackName}-api`,
      cloudWatchRole: false,
      deployOptions: {
        stageName: ETAPA,
        // La API acepta hasta 5 peticiones por segundo durante la práctica.
        // Si mandas más, responde 429: espera un momento e inténtalo de nuevo.
        throttlingRateLimit: 5,
        throttlingBurstLimit: 5,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowHeaders: ['Content-Type', 'x-api-key', 'x-origen'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
      },
    })

    // CDK agrega un output con la URL de la API. Lo quitamos: ApiUrl (abajo) ya la da sin diagonal final.
    api.node.tryRemoveChild('Endpoint')

    const gastos = api.root.addResource('gastos')
    gastos.addMethod('POST', new LambdaIntegration(registrar), { apiKeyRequired: true })
    // GET queda público solo en este workshop con datos ficticios.
    gastos.addMethod('GET', new LambdaIntegration(listar))

    // La API key que manda tu Atajo en el header x-api-key.
    const apiKey = api.addApiKey('GastosApiKey', {
      apiKeyName: `${this.stackName}-key-${versionKey.valueAsString}`,
    })

    // El Atajo usa este plan: 2 peticiones por segundo y 500 al día.
    const plan = api.addUsagePlan('GastosUsagePlan', {
      name: `${this.stackName}-plan`,
      throttle: { rateLimit: 2, burstLimit: 4 },
      quota: { limit: 500, period: Period.DAY },
      apiStages: [{ stage: api.deploymentStage }],
    })
    plan.addApiKey(apiKey)

    new CfnOutput(this, 'ApiUrl', {
      description: 'URL base de tu API',
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/${ETAPA}`,
    })
    new CfnOutput(this, 'ApiKeyId', {
      description: 'ID de la API key (el valor lo ves en la consola de API Gateway o con npm run datos)',
      value: apiKey.keyId,
    })
    new CfnOutput(this, 'TablaGastos', {
      description: 'Nombre de la tabla de DynamoDB',
      value: tabla.tableName,
    })
  }
}
