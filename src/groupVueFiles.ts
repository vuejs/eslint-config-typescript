import fs from 'node:fs'
import fg from 'fast-glob'
import path from 'node:path'
import { debuglog } from 'node:util'

const debug = debuglog('@vue/eslint-config-typescript:groupVueFiles')

type VueFilesByGroup = {
  typeCheckable: string[]
  nonTypeCheckable: string[]
}

export default function groupVueFiles(
  rootDir: string,
  globalIgnores: string[],
): VueFilesByGroup {
  debug(`Grouping .vue files in ${rootDir}`)

  const ignore = [
    '**/node_modules/**',
    '**/.git/**',

    // Global ignore patterns from ESLint config are relative to the ESLint base path,
    // which is usually the cwd, but could be different if `--config` is provided via CLI.
    // This is way too complicated, so we only use process.cwd() as a best-effort guess here.
    // Could be improved in the future if needed.
    ...globalIgnores.map(pattern =>
      fg.convertPathToPattern(path.resolve(process.cwd(), pattern)),
    ),
  ]
  debug(`Ignoring patterns: ${ignore.join(', ')}`)

  const { vueFilesWithScriptTs, otherVueFiles } = fg
    .sync(['**/*.vue'], {
      cwd: rootDir,
      ignore,
    })
    .reduce(
      (acc, file) => {
        const absolutePath = path.resolve(rootDir, file)
        const contents = fs.readFileSync(absolutePath, 'utf8')
        // contents matches the <script lang="ts"> (there can be anything but `>` between `script` and `lang`)
        if (/<script[^>]*\blang\s*=\s*"ts"[^>]*>/i.test(contents)) {
          acc.vueFilesWithScriptTs.push(file)
        } else {
          acc.otherVueFiles.push(file)
        }
        return acc
      },
      { vueFilesWithScriptTs: [] as string[], otherVueFiles: [] as string[] },
    )

  return {
    // Only `.vue` files with `<script lang="ts">` or `<script setup lang="ts">` can be type-checked.
    typeCheckable: vueFilesWithScriptTs,
    nonTypeCheckable: otherVueFiles,
  }
}
