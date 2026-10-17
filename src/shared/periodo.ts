// Cálculo del periodo de un presupuesto (semana o mes).
// Lo usan los handlers de presupuestos del módulo 7.
//
// Un presupuesto no se "reinicia" borrando nada: el gasto del periodo se calcula
// sumando los gastos con fecha >= inicioDelPeriodo(). El historial se conserva.

export type Periodo = 'semana' | 'mes'

export const PERIODOS: readonly Periodo[] = ['semana', 'mes']

// Zona horaria de quien registra los gastos. Llega desde template.yaml.
export const ZONA_HORARIA = process.env.ZONA_HORARIA ?? 'America/Mexico_City'

// Cuántos minutos está una zona horaria respecto a UTC en una fecha dada.
// Para America/Mexico_City regresa -360 (seis horas menos que UTC).
export function offsetEnMinutos(zona: string, fecha: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(fecha)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  const comoSiFueraUtc = Date.UTC(valor('year'), valor('month') - 1, valor('day'), valor('hour'), valor('minute'), valor('second'))
  return Math.round((comoSiFueraUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 60_000)
}

// Las semanas empiezan en lunes a las 00:00.
export function inicioDelPeriodo(periodo: Periodo, ahora: Date = new Date()): Date {
  const inicio = new Date(ahora)
  inicio.setUTCHours(0, 0, 0, 0)
  if (periodo === 'semana') {
    const dia = inicio.getUTCDay() // 0 = domingo, 1 = lunes
    const diasDesdeElLunes = (dia + 6) % 7
    inicio.setUTCDate(inicio.getUTCDate() - diasDesdeElLunes)
  } else {
    inicio.setUTCDate(1)
  }
  return inicio
}

// Cuándo empieza el siguiente periodo, para mostrar "se reinicia el lunes".
export function proximoReinicio(periodo: Periodo, ahora: Date = new Date()): Date {
  const siguiente = inicioDelPeriodo(periodo, ahora)
  if (periodo === 'semana') siguiente.setUTCDate(siguiente.getUTCDate() + 7)
  else siguiente.setUTCMonth(siguiente.getUTCMonth() + 1)
  return siguiente
}
