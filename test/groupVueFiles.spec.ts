import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import groupVueFiles from '../src/groupVueFiles'

const TS_SFC = '<script setup lang="ts">const a: number = 1</script>'
const JS_SFC = '<script setup>const a = 1</script>'

let tempDir: string
let originalCwd: string

function create(files: Record<string, string>) {
  for (const [file, contents] of Object.entries(files)) {
    const filename = path.join(tempDir, file)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, contents)
  }
}

beforeAll(() => {
  originalCwd = process.cwd()
  tempDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'vue-eslint-config-typescript-')),
  )

  create({
    'src/App.vue': TS_SFC,
    'src/components/Plain.vue': JS_SFC,
    '.hidden/Dot.vue': TS_SFC,
    'ignored-directory/Ignored.vue': TS_SFC,
    'node_modules/pkg/Dependency.vue': TS_SFC,
  })

  // Global ignore patterns are resolved against the cwd, so the lookup has to
  // run from the project directory to exercise them.
  process.chdir(tempDir)
})

afterAll(() => {
  process.chdir(originalCwd)
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('groupVueFiles', () => {
  test('splits files by whether their script block is TypeScript', () => {
    expect(groupVueFiles(tempDir, [])).toEqual({
      typeCheckable: ['ignored-directory/Ignored.vue', 'src/App.vue'],
      nonTypeCheckable: ['src/components/Plain.vue'],
    })
  })

  test('never looks inside node_modules', () => {
    const { typeCheckable, nonTypeCheckable } = groupVueFiles(tempDir, [], true)

    expect([...typeCheckable, ...nonTypeCheckable]).not.toContain(
      'node_modules/pkg/Dependency.vue',
    )
  })

  test('honors global ignore patterns', () => {
    expect(
      groupVueFiles(tempDir, ['**/ignored-directory/**']).typeCheckable,
    ).toEqual(['src/App.vue'])
  })

  test('picks up dot folders only when asked to', () => {
    expect(groupVueFiles(tempDir, []).typeCheckable).not.toContain(
      '.hidden/Dot.vue',
    )
    expect(groupVueFiles(tempDir, [], true).typeCheckable).toContain(
      '.hidden/Dot.vue',
    )
  })
})
