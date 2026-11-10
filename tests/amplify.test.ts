// amplify.yml le dice a Amplify Hosting qué publicar. Si instalara con npm, el build
// fallaría: el npm de Amplify es más viejo que el que pide package.json y
// engine-strict=true en .npmrc convierte esa diferencia en un error.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const texto = readFileSync(new URL('../amplify.yml', import.meta.url), 'utf8')
const sinComentarios = texto
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('#'))
  .join('\n')

describe('amplify.yml', () => {
  it('publica la carpeta web/', () => {
    expect(sinComentarios).toMatch(/baseDirectory:\s*web\s*$/m)
  })

  it('no corre npm: el npm de Amplify no cumple engines', () => {
    expect(sinComentarios).not.toMatch(/\b(npm|npx|pnpm|yarn)\b/)
  })
})
