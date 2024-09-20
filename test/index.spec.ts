import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, test } from 'vitest'
import { execa } from 'execa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runLintAgainst(projectName: string) {
  const projectDir = path.join(__dirname, '../examples', projectName)
  return execa({ preferLocal: true, cwd: projectDir })`pnpm lint`
}

describe('should pass lint without error in new projects', () => {
  test('minimal', async () => {
    runLintAgainst('minimal')
  })
  test('allow-js', async () => {
    runLintAgainst('allow-js')
  })
  
  test.todo('with-jsx', () => {})
  test.todo('with-jsx-in-vue', () => {})
  test.todo('with-tsx', () => {})
  test.todo('with-tsx-in-vue', () => {})
  
  test.todo('with-prettier', () => {})

  test.todo('with-cypress', () => {})
  test.todo('with-nightwatch', () => {})
  test.todo('with-playwright', () => {})
  
  test.todo('with-vitest', () => {})
})

describe('should report error on recommended rule violations in .vue files', () => {
  test.todo('minimal', () => {})
  test.todo('allow-js', () => {})
  // TODO:
  // ts-eslint disabled a few rules in eslint-recommended because tsc would catch them anyway
  // shall we check that if `vue-tsc` would catch these issues in plain `script` blocks?
  
  test.todo('with-jsx', () => {})
  test.todo('with-jsx-in-vue', () => {})
  test.todo('with-tsx', () => {})
  test.todo('with-tsx-in-vue', () => {})
  
  test.todo('with-prettier', () => {})

  test.todo('with-cypress', () => {})
  test.todo('with-nightwatch', () => {})
  test.todo('with-playwright', () => {})
  
  test.todo('with-vitest', () => {})
})

describe('should report error on recommended rule violations in other script files', () => {
  test.todo('minimal', () => {})
  test.todo('allow-js', () => {})
  
  test.todo('with-jsx', () => {})
  test.todo('with-jsx-in-vue', () => {})
  test.todo('with-tsx', () => {})
  test.todo('with-tsx-in-vue', () => {})
  
  test.todo('with-prettier', () => {})

  test.todo('with-cypress', () => {})
  test.todo('with-nightwatch', () => {})
  test.todo('with-playwright', () => {})
  
  test.todo('with-vitest', () => {})
})
