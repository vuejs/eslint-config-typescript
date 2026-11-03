import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import groupVueFiles from '../src/groupVueFiles'

describe('groupVueFiles', () => {
  let rootDir: string

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'group-vue-files-'))
    fs.writeFileSync(
      path.join(rootDir, 'WithTs.vue'),
      '<script setup lang="ts"></script>',
    )
    fs.writeFileSync(
      path.join(rootDir, 'WithJs.vue'),
      '<script setup></script>',
    )
    fs.writeFileSync(
      path.join(rootDir, 'Removed.vue'),
      '<script setup lang="ts"></script>',
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  // Simulates a file that is listed by the glob but gone by the time it is read,
  // e.g. when a branch is checked out while a long-lived ESLint process loads the config.
  function failReadingRemovedVue(code: string) {
    const readFileSync = fs.readFileSync
    vi.spyOn(fs, 'readFileSync').mockImplementation(((file, ...rest) => {
      if (String(file).endsWith('Removed.vue')) {
        throw Object.assign(new Error(`${code}: ${String(file)}`), { code })
      }
      return readFileSync(file, ...rest)
    }) as typeof fs.readFileSync)
  }

  test('groups .vue files by whether they have <script lang="ts">', () => {
    expect(groupVueFiles(rootDir, [])).toEqual({
      typeCheckable: expect.arrayContaining(['WithTs.vue', 'Removed.vue']),
      nonTypeCheckable: ['WithJs.vue'],
    })
  })

  test('skips files removed between globbing and reading', () => {
    failReadingRemovedVue('ENOENT')

    expect(groupVueFiles(rootDir, [])).toEqual({
      typeCheckable: ['WithTs.vue'],
      nonTypeCheckable: ['WithJs.vue'],
    })
  })

  test('rethrows other read errors', () => {
    failReadingRemovedVue('EACCES')

    expect(() => groupVueFiles(rootDir, [])).toThrow(
      expect.objectContaining({ code: 'EACCES' }),
    )
  })
})
