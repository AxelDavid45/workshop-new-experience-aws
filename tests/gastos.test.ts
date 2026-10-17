import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// En los tests no hablamos con DynamoDB de verdad: reemplazamos db.send.
const send = vi.fn()
vi.mock('../src/shared/db.ts', async (original) => ({
  ...(await original<typeof import('../src/shared/db.ts')>()),
  db: { send },
}))

const { validarGasto } = await import('../src/shared/validacion.ts')
const { handler } = await import('../src/handlers/registrar.ts')
const { handler: listar } = await import('../src/handlers/listar.ts')

function evento(body: unknown, headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return { body: JSON.stringify(body), headers, isBase64Encoded: false } as unknown as APIGatewayProxyEvent
}

describe('validarGasto', () => {
  it('acepta un gasto válido', () => {
    const r = validarGasto({ monto: 45, descripcion: 'café de la esquina', categoria: 'cafes' })
    expect(r).toEqual({ ok: true, valor: { monto: 45, descripcion: 'café de la esquina', categoria: 'cafes' } })
  })

  it('acepta la categoría con acento y mayúsculas, como la manda el Atajo', () => {
    const r = validarGasto({ monto: '38.5', descripcion: 'latte', categoria: ' Cafés ' })
    expect(r.ok && r.valor.categoria).toBe('cafes')
    expect(r.ok && r.valor.monto).toBe(38.5)
  })

  it('rechaza un body sin monto', () => {
    expect(validarGasto({ descripcion: 'galleta', categoria: 'snacks' }).ok).toBe(false)
  })

  it('rechaza una categoría que no existe', () => {
    expect(validarGasto({ monto: 20, descripcion: 'chicles', categoria: 'dulces' }).ok).toBe(false)
  })

  it('rechaza montos negativos', () => {
    expect(validarGasto({ monto: -50, descripcion: 'galleta', categoria: 'snacks' }).ok).toBe(false)
    expect(validarGasto({ monto: 0, descripcion: 'galleta', categoria: 'snacks' }).ok).toBe(false)
  })
})

describe('POST /gastos', () => {
  beforeEach(() => send.mockReset().mockResolvedValue({}))

  it('guarda el gasto y responde 201', async () => {
    const res = await handler(evento({ monto: 25, descripcion: 'galleta', categoria: 'snacks' }, { 'X-Origen': 'atajo' }))
    expect(res.statusCode).toBe(201)
    const gasto = JSON.parse(res.body)
    expect(gasto).toMatchObject({ monto: 25, categoria: 'snacks', origen: 'atajo' })
    expect(send).toHaveBeenCalledOnce()
    const item = send.mock.calls[0][0].input.Item
    expect(item.pk).toBe('GASTOS')
    expect(item.sk).toBe(`GASTO#${gasto.fecha}#${gasto.id}`)
  })

  it('responde 400 y no guarda nada si el gasto no es válido', async () => {
    const res = await handler(evento({ descripcion: 'sin monto', categoria: 'snacks' }))
    expect(res.statusCode).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('GET /gastos', () => {
  beforeEach(() => send.mockReset())

  it('pide los gastos con un Query, los más recientes primero', async () => {
    send.mockResolvedValue({ Items: [] })
    const res = await listar()
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ gastos: [] })
    expect(send).toHaveBeenCalledOnce()
    const comando = send.mock.calls[0][0]
    expect(comando).toBeInstanceOf(QueryCommand)
    expect(comando.input.ScanIndexForward).toBe(false)
    expect(comando.input.Limit).toBe(200)
  })

  it('regresa cada gasto sin pk ni sk', async () => {
    send.mockResolvedValue({
      Items: [
        {
          pk: 'GASTOS',
          sk: 'GASTO#2026-11-02T15:00:00.000Z#abc',
          id: 'abc',
          fecha: '2026-11-02T15:00:00.000Z',
          monto: 45,
          descripcion: 'café de la esquina',
          categoria: 'cafes',
          origen: 'atajo',
        },
      ],
    })
    const res = await listar()
    expect(JSON.parse(res.body).gastos).toEqual([
      {
        id: 'abc',
        fecha: '2026-11-02T15:00:00.000Z',
        monto: 45,
        descripcion: 'café de la esquina',
        categoria: 'cafes',
        origen: 'atajo',
      },
    ])
  })
})
