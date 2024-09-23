import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, test, expect } from 'vitest'
import { execa } from 'execa'

const WHITESPACE_ONLY = /^\s*$/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runLintAgainst(projectName: string) {
  const projectDir = path.join(__dirname, '../examples', projectName)
  // Use `pnpm` to avoid locating each `eslint` bin ourselves.
  // Use `--silent` to only print the output of the command, stripping the pnpm log.
  return execa({ preferLocal: true, cwd: projectDir })`pnpm --silent lint`
}

describe('should pass lint without error in new projects', () => {
  for (const projectName of [
    'minimal',
    'allow-js',
    'with-tsx',
    'with-tsx-in-vue',
    'with-jsx',
    'with-jsx-in-vue',
    'with-prettier',
    'with-cypress',
    'with-nightwatch',
    'with-playwright',
    'with-vitest',
  ]) {
    test(projectName, async () => {
      const { stdout } = await runLintAgainst(projectName)
      expect(stdout).toMatch(WHITESPACE_ONLY)
    })
  }
})

describe.todo(
  'should report error on recommended rule violations in .vue files',
  () => {
    test.todo('minimal', () => {})
    test.todo('allow-js', () => {})
    // TODO:
    // ts-eslint disabled a few rules in eslint-recommended because tsc would catch them anyway.
    // Shall we check that if `vue-tsc` would catch these issues in plain `script` blocks?

    test.todo('with-tsx', () => {})
    test.todo('with-tsx-in-vue', () => {})
    test.todo('with-jsx', () => {})
    test.todo('with-jsx-in-vue', () => {})

    test.todo('with-prettier', () => {})

    test.todo('with-cypress', () => {})
    test.todo('with-nightwatch', () => {})
    test.todo('with-playwright', () => {})

    test.todo('with-vitest', () => {})
  },
)

describe.todo(
  'should report error on recommended rule violations in other script files',
  () => {
    test.todo('minimal', () => {})
    test.todo('allow-js', () => {})

    test.todo('with-tsx', () => {})
    test.todo('with-tsx-in-vue', () => {})
    test.todo('with-jsx', () => {})
    test.todo('with-jsx-in-vue', () => {})

    test.todo('with-prettier', () => {})

    test.todo('with-cypress', () => {})
    test.todo('with-nightwatch', () => {})
    test.todo('with-playwright', () => {})

    test.todo('with-vitest', () => {})
  },
)
