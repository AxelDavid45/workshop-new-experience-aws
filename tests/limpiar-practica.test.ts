import { describe, expect, it, vi } from 'vitest'
import type { EjecutarAws } from '../scripts/limpiar-practica.ts'
import {
  FUNCION_PRACTICA,
  LOG_GROUP_PRACTICA,
  TABLA_PRACTICA,
  esRolDePractica,
  limpiarPractica,
} from '../scripts/limpiar-practica.ts'

describe('limpiar-practica', () => {
  it('solo acepta roles creados para la función de la práctica', () => {
    expect(esRolDePractica(`${FUNCION_PRACTICA}-role-abc123`)).toBe(true)
    expect(esRolDePractica('gastos-hormiga-registrar-role-abc123')).toBe(false)
  })

  it('borra la función, tabla, logs y rol exactos', async () => {
    const ejecutar = vi.fn(async (args: string[]) => {
      const comando = args.slice(0, 2).join(' ')
      if (comando === 'lambda get-function-configuration') {
        return { Role: `arn:aws:iam::123456789012:role/service-role/${FUNCION_PRACTICA}-role-abc123` }
      }
      if (comando === 'iam list-roles') {
        return { Roles: [{ RoleName: `${FUNCION_PRACTICA}-role-abc123` }, { RoleName: 'gastos-hormiga-registrar-role-abc123' }] }
      }
      if (comando === 'iam list-attached-role-policies') {
        return { AttachedPolicies: [{ PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' }] }
      }
      if (comando === 'iam list-role-policies') return { PolicyNames: [] }
      if (comando === 'dynamodb describe-table') return { Table: { TableName: TABLA_PRACTICA } }
      return {}
    })

    const borrados = await limpiarPractica(ejecutar as unknown as EjecutarAws)

    expect(borrados).toEqual([
      `Lambda ${FUNCION_PRACTICA}`,
      `log group ${LOG_GROUP_PRACTICA}`,
      `tabla ${TABLA_PRACTICA}`,
      `execution role ${FUNCION_PRACTICA}-role-abc123`,
    ])
    expect(ejecutar).toHaveBeenCalledWith(['lambda', 'delete-function', '--function-name', FUNCION_PRACTICA])
    expect(ejecutar).toHaveBeenCalledWith(['dynamodb', 'delete-table', '--table-name', TABLA_PRACTICA])
    expect(ejecutar).toHaveBeenCalledWith(['logs', 'delete-log-group', '--log-group-name', LOG_GROUP_PRACTICA])
    expect(ejecutar).not.toHaveBeenCalledWith(expect.arrayContaining(['gastos-hormiga-registrar-role-abc123']))
  })

  it('borra un rol huérfano de la práctica aunque la función ya no exista', async () => {
    const ejecutar = vi.fn(async (args: string[]) => {
      const comando = args.slice(0, 2).join(' ')
      if (comando === 'lambda get-function-configuration') throw new Error('ResourceNotFoundException')
      if (comando === 'iam list-roles') return { Roles: [{ RoleName: `${FUNCION_PRACTICA}-role-huerfano` }] }
      if (comando === 'iam list-attached-role-policies') return { AttachedPolicies: [] }
      if (comando === 'iam list-role-policies') return { PolicyNames: [] }
      if (comando === 'dynamodb describe-table' || comando === 'logs delete-log-group') {
        throw new Error('ResourceNotFoundException')
      }
      return {}
    })

    const borrados = await limpiarPractica(ejecutar as unknown as EjecutarAws)

    expect(borrados).toEqual([`execution role ${FUNCION_PRACTICA}-role-huerfano`])
    expect(ejecutar).toHaveBeenCalledWith(['iam', 'delete-role', '--role-name', `${FUNCION_PRACTICA}-role-huerfano`])
  })

  it('termina sin borrar cuando los recursos ya no existen', async () => {
    const ejecutar = vi.fn(async (args: string[]) => {
      const comando = args.slice(0, 2).join(' ')
      if (comando === 'iam list-roles') return { Roles: [] }
      throw new Error('ResourceNotFoundException: recurso no existe')
    })

    await expect(limpiarPractica(ejecutar as unknown as EjecutarAws)).resolves.toEqual([])
  })
})
