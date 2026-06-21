#!/usr/bin/env node

import process from 'node:process'

import { runMigrateToWithVueTsCommand } from './commands/migrateToWithVueTs'

const COMMANDS = {
  'migrate-to-with-vue-ts': runMigrateToWithVueTsCommand,
  'migrate-14.9': runMigrateToWithVueTsCommand,
} as const

function printHelp(): void {
  console.log(`Usage:
  vue-eslint-config-typescript <command> [args]

Commands:
  migrate-to-with-vue-ts   Primary command. Migrate legacy helper-based configs to withVueTs(...)
  migrate-14.9             Versioned alias for migrate-to-with-vue-ts
`)
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  const runCommand = COMMANDS[command as keyof typeof COMMANDS]
  if (!runCommand) {
    console.error(`Unknown command: ${command}\n`)
    printHelp()
    process.exitCode = 1
    return
  }

  await runCommand(args)
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error(message)
  process.exitCode = 1
})
