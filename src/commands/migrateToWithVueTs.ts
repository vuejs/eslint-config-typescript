import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'

import fg from 'fast-glob'

import {
  analyzeToWithVueTsMigrationText,
  applyToWithVueTsMigrationText,
} from '../migrations/toWithVueTs'

type CliOptions = {
  yes: boolean
  help: boolean
  patterns: string[]
}

type MigrationCandidate = {
  filename: string
  relativeFilename: string
  analysis: ReturnType<typeof analyzeToWithVueTsMigrationText>
}

const DEFAULT_PATTERNS = ['**/eslint.config.{js,mjs,ts,mts}']
const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**']

function isFixableCandidate(
  candidate: MigrationCandidate,
): candidate is MigrationCandidate & {
  analysis: Extract<MigrationCandidate['analysis'], { status: 'fixable' }>
} {
  return candidate.analysis.status === 'fixable'
}

function isUnsupportedCandidate(
  candidate: MigrationCandidate,
): candidate is MigrationCandidate & {
  analysis: Extract<
    MigrationCandidate['analysis'],
    { status: 'unsupported' } | { status: 'parse-error' }
  >
} {
  return (
    candidate.analysis.status === 'unsupported' ||
    candidate.analysis.status === 'parse-error'
  )
}

function parseArgs(argv: string[]): CliOptions {
  return {
    yes: argv.includes('--yes') || argv.includes('-y'),
    help: argv.includes('--help') || argv.includes('-h'),
    patterns: argv.filter(
      arg => !['--yes', '-y', '--help', '-h'].includes(arg),
    ),
  }
}

function printHelp(): void {
  console.log(`Usage:
  vue-eslint-config-typescript migrate-to-with-vue-ts [paths...] [--yes]

Examples:
  npx @vue/eslint-config-typescript migrate-to-with-vue-ts
  npx @vue/eslint-config-typescript migrate-to-with-vue-ts eslint.config.ts
  npx @vue/eslint-config-typescript migrate-to-with-vue-ts "packages/*/eslint.config.ts" --yes
`)
}

async function resolveTargetFiles(patterns: string[]): Promise<string[]> {
  const targetPatterns = patterns.length > 0 ? patterns : DEFAULT_PATTERNS
  const explicitFiles: string[] = []
  const globPatterns: string[] = []

  for (const pattern of targetPatterns) {
    const filename = path.resolve(pattern)
    const stat = await fs.stat(filename).catch(() => undefined)
    if (stat?.isFile()) {
      explicitFiles.push(filename)
      continue
    }

    globPatterns.push(pattern)
  }

  const entries = await fg(globPatterns, {
    cwd: process.cwd(),
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: DEFAULT_IGNORE,
  })

  return [...new Set([...explicitFiles, ...entries])].sort()
}

async function loadCandidates(
  filenames: string[],
): Promise<MigrationCandidate[]> {
  return Promise.all(
    filenames.map(async filename => {
      const text = await fs.readFile(filename, 'utf8')
      return {
        filename,
        relativeFilename:
          path.relative(process.cwd(), filename) || path.basename(filename),
        analysis: analyzeToWithVueTsMigrationText(text, filename),
      }
    }),
  )
}

function printSummary(candidates: MigrationCandidate[]): void {
  const fixable = candidates.filter(isFixableCandidate)
  const unsupported = candidates.filter(isUnsupportedCandidate)

  console.log(`Found ${candidates.length} ESLint config file(s).\n`)

  if (fixable.length > 0) {
    console.log('Auto-migratable:')
    for (const candidate of fixable) {
      console.log(`- ${candidate.relativeFilename}`)
      for (const change of candidate.analysis.changes) {
        console.log(`  - ${change}`)
      }
    }
    console.log('')
  }

  if (unsupported.length > 0) {
    console.log('Needs manual review:')
    for (const candidate of unsupported) {
      console.log(`- ${candidate.relativeFilename}`)
      if (candidate.analysis.status === 'parse-error') {
        console.log(`  - parser error: ${candidate.analysis.reason}`)
        continue
      }

      for (const reason of candidate.analysis.reasons) {
        console.log(`  - ${reason}`)
      }
    }
    console.log('')
  }

  if (fixable.length === 0 && unsupported.length === 0) {
    console.log('No migration needed.\n')
  }
}

async function confirmApply(): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = (await readline.question('Apply automatic changes? [Y/n] '))
      .trim()
      .toLowerCase()

    return answer === '' || answer === 'y' || answer === 'yes'
  } finally {
    readline.close()
  }
}

async function applyFixes(candidates: MigrationCandidate[]): Promise<number> {
  let updatedFiles = 0

  for (const candidate of candidates) {
    if (candidate.analysis.status !== 'fixable') {
      continue
    }

    const input = await fs.readFile(candidate.filename, 'utf8')
    const result = applyToWithVueTsMigrationText(input, candidate.filename)
    if (!result.changed) {
      continue
    }

    await fs.writeFile(candidate.filename, result.output)
    updatedFiles += 1
  }

  return updatedFiles
}

export async function runMigrateToWithVueTsCommand(
  argv: string[],
): Promise<void> {
  const options = parseArgs(argv)
  if (options.help) {
    printHelp()
    return
  }

  const filenames = await resolveTargetFiles(options.patterns)
  if (filenames.length === 0) {
    console.log('No matching ESLint config files found.')
    return
  }

  const candidates = await loadCandidates(filenames)
  printSummary(candidates)

  const fixableCount = candidates.filter(isFixableCandidate).length
  if (fixableCount === 0) {
    return
  }

  if (!options.yes && !process.stdin.isTTY) {
    console.log(
      'Cannot prompt in a non-interactive terminal. Re-run with `--yes` to apply the automatic changes.',
    )
    return
  }

  const shouldApply = options.yes ? true : await confirmApply()
  if (!shouldApply) {
    console.log('No files were changed.')
    return
  }

  const updatedFiles = await applyFixes(candidates)
  console.log(`Updated ${updatedFiles} file(s).`)
}
