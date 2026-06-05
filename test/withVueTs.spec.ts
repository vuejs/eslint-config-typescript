import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'eslint/config'
import { describe, expect, test } from 'vitest'
import { execa } from 'execa'

import { withVueTs, vueTsConfigs } from '../src'

const WHITESPACE_ONLY = /^\s*$/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runLintAgainst(projectName: string) {
  const projectDir = path.join(__dirname, './fixtures', projectName)
  return execa({
    preferLocal: true,
    cwd: projectDir,
    reject: false,
  })`pnpm --silent lint`
}

function setupFileMutations(filename: string) {
  const fileContents = fs.readFileSync(filename, 'utf8')

  function modify(getNewContents: (oldContents: string) => string) {
    fs.writeFileSync(filename, getNewContents(fileContents))
  }

  function restore() {
    fs.writeFileSync(filename, fileContents)
  }

  return { modify, restore }
}

describe('withVueTs', () => {
  test('accepts the options-first form', async () => {
    const config = await withVueTs(
      {
        scriptLangs: ['ts', 'js'],
      },
      vueTsConfigs.recommended,
    )

    const setupConfig = config.find(
      item => item.name === '@vue/typescript/setup',
    )
    expect(setupConfig).toBeDefined()

    const blockLangRule = setupConfig?.rules?.['vue/block-lang']
    expect(Array.isArray(blockLangRule)).toBe(true)

    const [, options] = blockLangRule as [
      string,
      { script: { allowNoLang: boolean } },
    ]
    expect(options.script.allowNoLang).toBe(true)
  })

  test('accepts promised defineConfig output for interop', async () => {
    const config = await withVueTs(
      {
        scriptLangs: ['ts', 'js'],
      },
      Promise.resolve(
        defineConfig({
          extends: [vueTsConfigs.recommended],
        }),
      ),
    )

    const setupConfig = config.find(
      item => item.name === '@vue/typescript/setup',
    )
    expect(setupConfig).toBeDefined()

    const blockLangRule = setupConfig?.rules?.['vue/block-lang']
    expect(Array.isArray(blockLangRule)).toBe(true)

    const [, options] = blockLangRule as [
      string,
      { script: { allowNoLang: boolean } },
    ]
    expect(options.script.allowNoLang).toBe(true)
  })

  test('treats a promised config in first position as config, not options', async () => {
    const config = await withVueTs(
      Promise.resolve(
        defineConfig({
          extends: [vueTsConfigs.recommended],
        }),
      ),
    )

    expect(config.some(item => item.name === '@vue/typescript/setup')).toBe(
      true,
    )
  })

  test('works when exported from eslint.config.js', async () => {
    const { failed, stdout } = await runLintAgainst('with-vue-ts-api')
    expect(failed).toBe(false)
    expect(stdout).toMatch(WHITESPACE_ONLY)
  })

  test('still accepts the config-only form', async () => {
    const config = await withVueTs(vueTsConfigs.recommended)

    expect(config.some(item => item.name === '@vue/typescript/setup')).toBe(
      true,
    )
  })

  test('adds project service configs for type-checked presets', async () => {
    const config = await withVueTs(
      {
        rootDir: path.join(__dirname, './fixtures/with-vue-ts-api'),
      },
      vueTsConfigs.recommendedTypeChecked,
    )

    expect(
      config.some(
        item =>
          item.name === '@vue/typescript/default-project-service-for-ts-files',
      ),
    ).toBe(true)
    expect(
      config.some(
        item =>
          item.name === '@vue/typescript/default-project-service-for-vue-files',
      ),
    ).toBe(true)
  })

  test('applies TypeScript rules to .vue files', async () => {
    const appVuePath = path.join(
      __dirname,
      './fixtures/with-vue-ts-api/src/App.vue',
    )
    const { modify, restore } = setupFileMutations(appVuePath)

    modify(oldContents =>
      oldContents.replace('</script>', '// @ts-ignore\n</script>'),
    )
    const { failed, stdout, stderr } = await runLintAgainst('with-vue-ts-api')
    restore()

    const output = [stdout, stderr].join('\n')
    expect(failed).toBe(true)
    expect(output).toContain('App.vue')
    expect(output).toContain('@typescript-eslint/ban-ts-comment')
  })

  test('rejects mixed first-argument option/config objects', async () => {
    const ambiguousFirstArg = {
      rootDir: __dirname,
      files: ['**/*.ts'],
    }

    await expect(
      withVueTs(ambiguousFirstArg as never, vueTsConfigs.recommended),
    ).rejects.toThrow(
      'cannot mix Vue project options with ESLint config keys',
    )
  })
})
