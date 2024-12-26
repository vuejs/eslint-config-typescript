import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, test, expect } from 'vitest'
import { execa } from 'execa'

const WHITESPACE_ONLY = /^\s*$/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FROM_EXAMPLES = 'FROM_EXAMPLES'
const FROM_FIXTURES = 'FROM_FIXTURES'
type ProjectType = 'FROM_EXAMPLES' | 'FROM_FIXTURES'

function runLintAgainst(projectName: string, projectType: ProjectType = FROM_EXAMPLES) {
  const parentDir = path.join(__dirname, projectType === FROM_EXAMPLES ? '../examples' : './fixtures')
  const projectDir = path.join(parentDir, projectName)
  // Use `pnpm` to avoid locating each `eslint` bin ourselves.
  // Use `--silent` to only print the output of the command, stripping the pnpm log.
  return execa({
    preferLocal: true,
    cwd: projectDir,
    reject: false,
  })`pnpm --silent lint`
}

function setupFileMutations(filename: string) {
  // Read the file
  const fileContents = fs.readFileSync(filename, 'utf8')

  // Implementation for modifying and restoring the file
  function modify(getNewContents: (oldContents: string) => string) {
    fs.writeFileSync(filename, getNewContents(fileContents))
  }

  function restore() {
    fs.writeFileSync(filename, fileContents)
  }

  return { modify, restore }
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
    'type-checked',
    'api-before-14.3',
  ]) {
    test(projectName, async () => {
      const { stdout } = await runLintAgainst(projectName)
      expect(stdout).toMatch(WHITESPACE_ONLY)
    })
  }
})

describe('should report error on recommended rule violations in .vue files', () => {
  function appendBannedTsCommentToVueScript(oldContents: string) {
    return oldContents.replace('</script>', '// @ts-ignore\n</script>')
  }
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
    'type-checked',
    'api-before-14.3',
  ]) {
    test(`src/App.vue in ${projectName}`, async () => {
      const appVuePath = path.join(
        __dirname,
        '../examples',
        projectName,
        'src/App.vue',
      )

      const { modify, restore } = setupFileMutations(appVuePath)
      modify(appendBannedTsCommentToVueScript)
      const { failed, stdout } = await runLintAgainst(projectName)
      restore()

      expect(failed).toBe(true)
      expect(stdout).toContain('App.vue')
      expect(stdout).toContain('@typescript-eslint/ban-ts-comment')
    })
  }
})

describe('should report error on recommended rule violations in other script files', () => {
  function appendBannedTsComment(oldContents: string) {
    return oldContents + '\n// @ts-ignore\n'
  }

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
    'type-checked',
    'api-before-14.3',
  ]) {
    test(`main.ts in ${projectName}`, async () => {
      const mainTsPath = path.join(
        __dirname,
        '../examples',
        projectName,
        'src/main.ts',
      )

      const { modify, restore } = setupFileMutations(mainTsPath)
      modify(appendBannedTsComment)
      const { failed, stdout } = await runLintAgainst(projectName)
      restore()

      expect(failed).toBe(true)
      expect(stdout).toContain('main.ts')
      expect(stdout).toContain(' @typescript-eslint/ban-ts-comment')
    })
  }

  function appendThisAlias(oldContents: string) {
    return (
      oldContents +
      `
class Example {
  method() {
    const that = this;
    console.log(that.method)
  }
}
new Example()
`
    )
  }

  test('.js in allow-js', async () => {
    const jsPath = path.join(__dirname, '../examples/allow-js/src/foo.js')
    const { modify, restore } = setupFileMutations(jsPath)
    modify(appendThisAlias)
    const { failed, stdout } = await runLintAgainst('allow-js')
    restore()

    expect(failed).toBe(true)
    expect(stdout).toContain('@typescript-eslint/no-this-alias')
  })
  test('.tsx in with-tsx', async () => {
    const tsxPath = path.join(__dirname, '../examples/with-tsx/src/FooComp.tsx')
    const { modify, restore } = setupFileMutations(tsxPath)
    modify(appendThisAlias)
    const { failed, stdout } = await runLintAgainst('with-tsx')
    restore()

    expect(failed).toBe(true)
    expect(stdout).toContain('@typescript-eslint/no-this-alias')
  })
  test('.jsx in with-jsx', async () => {
    const jsxPath = path.join(__dirname, '../examples/with-jsx/src/FooComp.jsx')
    const { modify, restore } = setupFileMutations(jsxPath)
    modify(appendThisAlias)
    const { failed, stdout } = await runLintAgainst('with-jsx')
    restore()

    expect(failed).toBe(true)
    expect(stdout).toContain('@typescript-eslint/no-this-alias')
  })
})

test('#87: should not error if the project root has an older version of espree installed', async () => {
  const { stdout } = await runLintAgainst('with-older-espree', FROM_FIXTURES)
  expect(stdout).toMatch(WHITESPACE_ONLY)
})

test('#102: should set configs correctly for paths with glob-like syntax (e.g. file-based-routing patterns)', async () => {
  const { stdout } = await runLintAgainst('file-based-routing', FROM_FIXTURES)
  expect(stdout).toMatch(WHITESPACE_ONLY)
})

test.only('(API before 14.3) should guide user to use camelCase names in "extends"', async () => {
  const eslintConfigPath = path.join(__dirname, '../examples/api-before-14.3/eslint.config.js')
  const { modify, restore } = setupFileMutations(eslintConfigPath)
  modify((oldContents) => oldContents.replace('recommendedTypeChecked', 'recommended-type-checked'))
  const { failed, stderr } = await runLintAgainst('api-before-14.3')
  restore()

  expect(failed).toBe(true)
  expect(stderr).contain('Please use "recommendedTypeChecked"')
})
