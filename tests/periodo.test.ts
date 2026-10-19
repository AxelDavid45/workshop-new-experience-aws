import { describe, expect, it } from 'vitest'
import { inicioDelPeriodo, offsetEnMinutos, proximoReinicio } from '../src/shared/periodo.ts'

// Todas las fechas de estos tests están pensadas en America/Mexico_City (UTC-6,
// sin horario de verano desde 2022). La Lambda corre en UTC.

describe('offsetEnMinutos', () => {
  it('Ciudad de México está 6 horas detrás de UTC', () => {
    expect(offsetEnMinutos('America/Mexico_City', new Date('2026-11-09T02:00:00Z'))).toBe(-360)
  })
})

describe.skip('periodo de un presupuesto en America/Mexico_City', () => {
  it('un café del domingo a las 8 pm cuenta en la semana que termina ese domingo', () => {
    // Domingo 8 de noviembre de 2026, 20:00 en CDMX = lunes 9, 02:00 en UTC
    const domingoEnLaNoche = new Date('2026-11-09T02:00:00Z')
    // La semana empezó el lunes 2 de noviembre a las 00:00 en CDMX = 06:00 UTC
    expect(inicioDelPeriodo('semana', domingoEnLaNoche).toISOString()).toBe('2026-11-02T06:00:00.000Z')
    expect(proximoReinicio('semana', domingoEnLaNoche).toISOString()).toBe('2026-11-09T06:00:00.000Z')
  })

  it('un gasto del último día del mes a las 8 pm cuenta en ese mes', () => {
    // Lunes 30 de noviembre de 2026, 20:00 en CDMX = 1 de diciembre, 02:00 en UTC
    const finDeMes = new Date('2026-12-01T02:00:00Z')
    expect(inicioDelPeriodo('mes', finDeMes).toISOString()).toBe('2026-11-01T06:00:00.000Z')
    expect(proximoReinicio('mes', finDeMes).toISOString()).toBe('2026-12-01T06:00:00.000Z')
  })

  it('a media semana el periodo empieza el lunes anterior', () => {
    // Miércoles 4 de noviembre de 2026, 13:00 en CDMX
    const miercoles = new Date('2026-11-04T19:00:00Z')
    expect(inicioDelPeriodo('semana', miercoles).toISOString()).toBe('2026-11-02T06:00:00.000Z')
  })
})
