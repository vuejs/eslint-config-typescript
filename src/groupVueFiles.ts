import fs from 'node:fs'
import fg from 'fast-glob'
import path from 'node:path'

type VueFilesByGroup = {
  typeCheckable: string[]
  nonTypeCheckable: string[]
}

export default function groupVueFiles(rootDir: string): VueFilesByGroup {
  const { vueFilesWithScriptTs, otherVueFiles } = fg
    .sync(['**/*.vue'], {
      cwd: rootDir,
      ignore: ['**/node_modules/**'],
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
