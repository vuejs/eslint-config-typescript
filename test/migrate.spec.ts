import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'
import { execa } from 'execa'

import { applyToWithVueTsMigrationText } from '../src/migrations/toWithVueTs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const binPath = path.join(repoRoot, 'dist/bin.js')

function copyFixtureToTempDir(fixtureName: string): {
  tempDir: string
  restore: () => void
} {
  const sourceDir = path.join(__dirname, 'fixtures', fixtureName)
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `vue-eslint-config-typescript-${fixtureName}-`),
  )

  fs.cpSync(sourceDir, tempDir, { recursive: true })

  return {
    tempDir,
    restore() {
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

function runMigrationCli(cwd: string, ...args: string[]) {
  return execa('node', [binPath, 'migrate-to-with-vue-ts', ...args], {
    cwd,
    reject: false,
  })
}

describe('withVueTs migration', () => {
  test('rewrites legacy helper-based JS configs', () => {
    const filename = path.join(
      __dirname,
      'fixtures',
      'migrate-legacy-js',
      'eslint.config.js',
    )
    const input = fs.readFileSync(filename, 'utf8')

    const result = applyToWithVueTsMigrationText(input, filename)

    expect(result.analysis.status).toBe('fixable')
    expect(result.changed).toBe(true)
    expect(result.output).toContain(
      "import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'",
    )
    expect(result.output).toContain('export default withVueTs(')
    expect(result.output).toContain("scriptLangs: ['ts', 'js']")
    expect(result.output).toContain('includeDotFolders: true')
    expect(result.output).not.toContain('defineConfigWithVueTs')
    expect(result.output).not.toContain('configureVueProject')
  })

  test('migrate CLI rewrites discovered .ts config files', async () => {
    const { tempDir, restore } = copyFixtureToTempDir('migrate-legacy-ts')

    try {
      const { stdout, failed } = await runMigrationCli(tempDir, '--yes')

      expect(failed).toBe(false)
      expect(stdout).toContain('Auto-migratable:')
      expect(stdout).toContain('Updated 1 file(s).')

      const migrated = fs.readFileSync(
        path.join(tempDir, 'eslint.config.ts'),
        'utf8',
      )

      expect(migrated).toContain(
        "import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'",
      )
      expect(migrated).toContain('const config = withVueTs(')
      expect(migrated).toContain('projectOptions')
      expect(migrated).not.toContain('defineConfigWithVueTs')
      expect(migrated).not.toContain('configureVueProject')
    } finally {
      restore()
    }
  })

  test('migrate CLI accepts explicit JS paths', async () => {
    const { tempDir, restore } = copyFixtureToTempDir('migrate-legacy-js')

    try {
      const { stdout, failed } = await runMigrationCli(
        tempDir,
        'eslint.config.js',
        '--yes',
      )

      expect(failed).toBe(false)
      expect(stdout).toContain('Updated 1 file(s).')

      const migrated = fs.readFileSync(
        path.join(tempDir, 'eslint.config.js'),
        'utf8',
      )
      expect(migrated).toContain('export default withVueTs(')
    } finally {
      restore()
    }
  })

  test('migrate CLI accepts the 14.9 versioned alias', async () => {
    const { tempDir, restore } = copyFixtureToTempDir('migrate-legacy-js')

    try {
      const { stdout, failed } = await execa(
        'node',
        [binPath, 'migrate-14.9', 'eslint.config.js', '--yes'],
        {
          cwd: tempDir,
          reject: false,
        },
      )

      expect(failed).toBe(false)
      expect(stdout).toContain('Updated 1 file(s).')

      const migrated = fs.readFileSync(
        path.join(tempDir, 'eslint.config.js'),
        'utf8',
      )
      expect(migrated).toContain('export default withVueTs(')
    } finally {
      restore()
    }
  })

  test('migrate CLI reports unsupported createConfig usage without changing files', async () => {
    const { tempDir, restore } = copyFixtureToTempDir('migrate-create-config')
    const filename = path.join(tempDir, 'eslint.config.js')
    const original = fs.readFileSync(filename, 'utf8')

    try {
      const { stdout, failed } = await runMigrationCli(tempDir, '--yes')

      expect(failed).toBe(false)
      expect(stdout).toContain('Needs manual review:')
      expect(stdout).toContain('createConfig')
      expect(stdout).not.toContain('Updated 1 file(s).')
      expect(fs.readFileSync(filename, 'utf8')).toBe(original)
    } finally {
      restore()
    }
  })

  test('migrate CLI accepts explicit absolute paths outside cwd', async () => {
    const { tempDir, restore } = copyFixtureToTempDir('migrate-legacy-ts')
    const filename = path.join(tempDir, 'eslint.config.ts')

    try {
      const { stdout, failed } = await runMigrationCli(
        repoRoot,
        filename,
        '--yes',
      )

      expect(failed).toBe(false)
      expect(stdout).toContain('Auto-migratable:')
      expect(stdout).toContain('Updated 1 file(s).')
      expect(fs.readFileSync(filename, 'utf8')).toContain('withVueTs(')
    } finally {
      restore()
    }
  })

  test('reports unsupported when configureVueProject is not a top-level call', () => {
    const input = `import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, configureVueProject, vueTsConfigs } from '@vue/eslint-config-typescript'

if (process.env.CI) configureVueProject({ rootDir: import.meta.dirname })

export default defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
`

    const result = applyToWithVueTsMigrationText(input, 'eslint.config.mjs')

    expect(result.analysis.status).toBe('unsupported')
    if (result.analysis.status === 'unsupported') {
      expect(result.analysis.reasons).toContain(
        'Only top-level `configureVueProject(...)` calls are supported by this migration.',
      )
    }
  })

  test('reports unsupported for reassigned exported variables', () => {
    const input = `import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

let config = defineConfigWithVueTs(
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
config = []
export default config
`

    const result = applyToWithVueTsMigrationText(input, 'eslint.config.mjs')

    expect(result.analysis.status).toBe('unsupported')
  })

  test('reports unsupported for ambiguous first-argument option objects', () => {
    const input = `import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

const shared = { rootDir: import.meta.dirname }

export default defineConfigWithVueTs(
  { ...shared, rootDir: import.meta.dirname },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
)
`

    const result = applyToWithVueTsMigrationText(input, 'eslint.config.ts')

    expect(result.analysis.status).toBe('unsupported')
    if (result.analysis.status === 'unsupported') {
      expect(result.analysis.reasons).toContain(
        'The first argument to `defineConfigWithVueTs()` could be reinterpreted as `withVueTs()` project options. Please migrate this case manually.',
      )
    }
  })
})
