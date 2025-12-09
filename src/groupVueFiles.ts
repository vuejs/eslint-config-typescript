import fs from 'node:fs'
import fg from 'fast-glob'
import path from 'node:path'
import { debuglog } from 'node:util'

const debug = debuglog('@vue/eslint-config-typescript:groupVueFiles')

type VueFilesByGroup = {
  typeCheckable: string[]
  nonTypeCheckable: string[]
}

export default function groupVueFiles(rootDir: string): VueFilesByGroup {
  debug(`Grouping .vue files in ${rootDir}`)
  
  const ignore = ['**/node_modules/**', '**/.git/**']
  // FIXME: to get global ignore patterns from user config
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
