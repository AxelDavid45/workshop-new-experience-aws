import { CONFIG, aws } from './aws.ts'

export interface Salidas {
  ApiUrl?: string
  ApiKeyId?: string
  TablaGastos?: string
  UserPoolId?: string
  UserPoolClientId?: string
  [clave: string]: string | undefined
}

interface DescribeStacks {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string; OutputValue: string }[]; Parameters?: { ParameterKey: string; ParameterValue: string }[] }[]
}

export async function describirStack() {
  const r = await aws<DescribeStacks>(['cloudformation', 'describe-stacks', '--stack-name', CONFIG.stack])
  const stack = r.Stacks[0]
  const salidas: Salidas = {}
  for (const o of stack.Outputs ?? []) salidas[o.OutputKey] = o.OutputValue
  const parametros: Record<string, string> = {}
  for (const p of stack.Parameters ?? []) parametros[p.ParameterKey] = p.ParameterValue
  return { estado: stack.StackStatus, salidas, parametros }
}

export async function salidasDelStack(): Promise<Salidas> {
  return (await describirStack()).salidas
}

export async function valorDeLaKey(apiKeyId: string): Promise<string> {
  const r = await aws<{ value: string }>(['apigateway', 'get-api-key', '--api-key', apiKeyId, '--include-value'])
  return r.value
}
