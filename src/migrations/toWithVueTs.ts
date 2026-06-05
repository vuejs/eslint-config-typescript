import path from 'node:path'

import { Linter, type SourceCode } from 'eslint'
import type { Rule } from 'eslint'
import tseslint from 'typescript-eslint'

import {
  getCallToLocalNames,
  getNodeText,
  getRequiredRange,
  getStatementRemovalRange,
  isIdentifier,
  unwrapExpression,
  visitAst,
  type CallExpressionNode,
  type ExpressionStatementNode,
  type ExportDefaultDeclarationNode,
  type IdentifierNode,
  type IdentifierUsage,
  type ImportDeclarationNode,
} from './astHelpers'

const MIGRATION_PLUGIN_NAME = 'vue-ts-migrate'
const MIGRATION_RULE_NAME = 'to-with-vue-ts'
const MIGRATION_RULE_ID = `${MIGRATION_PLUGIN_NAME}/${MIGRATION_RULE_NAME}`
const PACKAGE_NAME = '@vue/eslint-config-typescript'

const LEGACY_HELPER_IMPORTS = new Set(['defineConfigWithVueTs', 'defineConfig'])
const PROJECT_OPTIONS_KEYS = new Set([
  'tsSyntaxInTemplates',
  'scriptLangs',
  'allowComponentTypeUnsafety',
  'includeDotFolders',
  'rootDir',
])

type TextEdit = {
  range: [number, number]
  text: string
}

export type ToWithVueTsMigrationAnalysis =
  | {
      status: 'noop'
    }
  | {
      status: 'parse-error'
      reason: string
    }
  | {
      status: 'unsupported'
      reasons: string[]
    }
  | {
      status: 'fixable'
      changes: string[]
      edits: TextEdit[]
    }

export type AppliedToWithVueTsMigration = {
  analysis: ToWithVueTsMigrationAnalysis
  changed: boolean
  output: string
}

type PackageImportSpecifier = ImportDeclarationNode['specifiers'][number]

type ImportCollection = {
  declarations: ImportDeclarationNode[]
  legacyHelperLocalNames: Set<string>
  configureVueProjectLocalNames: Set<string>
  withVueTsLocalName?: string
  unsupportedReasons: string[]
}

type LegacyTarget = {
  call: CallExpressionNode
  helperLocalName: string
}

type ConfigureVueProjectStatement = {
  statement: ExpressionStatementNode
  call: CallExpressionNode
}

type MigrationFacts = {
  imports: ImportCollection
  configureStatements: ConfigureVueProjectStatement[]
  legacyTarget?: LegacyTarget
}

type FixableMigrationFacts = MigrationFacts & {
  legacyTarget: LegacyTarget
}

type TopLevelVariableTarget = {
  call: CallExpressionNode
  kind: 'const' | 'let' | 'var'
}

type FirstArgumentClassification = 'config' | 'options' | 'ambiguous-options'

function isTsConfigFile(filename: string): boolean {
  return ['.ts', '.mts'].includes(path.extname(filename))
}

function getLintFilename(filename: string): string {
  return path.basename(filename)
}

function getBaseConfig(filename: string): Linter.Config[] {
  return [
    {
      files: [
        '**/*.js',
        '**/*.mjs',
        '**/*.ts',
        '**/*.mts',
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.ts',
        'eslint.config.mts',
        '**/eslint.config.js',
        '**/eslint.config.mjs',
        '**/eslint.config.ts',
        '**/eslint.config.mts',
      ],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...(isTsConfigFile(filename) ? { parser: tseslint.parser } : {}),
      },
    },
  ]
}

function parseSourceCode(
  text: string,
  filename: string,
): { sourceCode?: SourceCode; error?: string } {
  const lintFilename = getLintFilename(filename)
  const linter = new Linter({ configType: 'flat' })
  const messages = linter.verify(text, getBaseConfig(lintFilename), {
    filename: lintFilename,
  })
  const sourceCode = linter.getSourceCode()
  if (!sourceCode) {
    return {
      error:
        messages.find(message => message.fatal)?.message ??
        messages[0]?.message,
    }
  }

  return {
    sourceCode,
  }
}

function getImportSpecifierImportedName(
  specifier: PackageImportSpecifier,
): string | undefined {
  if (specifier.type !== 'ImportSpecifier') {
    return
  }

  if (typeof specifier.imported === 'string') {
    return specifier.imported
  }

  const imported = specifier.imported as {
    name?: string
    value?: string
  }
  return imported.name ?? imported.value
}

function collectVueImports(sourceCode: SourceCode): ImportCollection {
  const declarations: ImportDeclarationNode[] = []
  const legacyHelperLocalNames = new Set<string>()
  const configureVueProjectLocalNames = new Set<string>()
  let withVueTsLocalName: string | undefined
  const unsupportedReasons: string[] = []

  for (const statement of sourceCode.ast.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue
    }
    if (statement.source.value !== PACKAGE_NAME) {
      continue
    }

    declarations.push(statement)

    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        unsupportedReasons.push(
          'Default `createConfig()` imports are not supported by this migration yet.',
        )
        continue
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        unsupportedReasons.push(
          'Namespace imports from `@vue/eslint-config-typescript` are not supported by this migration yet.',
        )
        continue
      }

      const importedName = getImportSpecifierImportedName(specifier)
      if (!importedName) {
        continue
      }

      if (LEGACY_HELPER_IMPORTS.has(importedName)) {
        legacyHelperLocalNames.add(specifier.local.name)
      }

      if (importedName === 'configureVueProject') {
        configureVueProjectLocalNames.add(specifier.local.name)
      }

      if (importedName === 'withVueTs') {
        withVueTsLocalName = specifier.local.name
      }

      if (importedName === 'createConfig') {
        unsupportedReasons.push(
          '`createConfig()` uses the older array-spread API and is not supported by this migration yet.',
        )
      }
    }
  }

  return {
    declarations,
    legacyHelperLocalNames,
    configureVueProjectLocalNames,
    withVueTsLocalName,
    unsupportedReasons,
  }
}

function findConfigureVueProjectStatements(
  sourceCode: SourceCode,
  localNames: Set<string>,
): ConfigureVueProjectStatement[] {
  if (localNames.size === 0) {
    return []
  }

  return sourceCode.ast.body.flatMap(statement => {
    if (statement.type !== 'ExpressionStatement') {
      return []
    }

    const call = getCallToLocalNames(statement.expression, localNames)
    return call ? [{ statement, call }] : []
  })
}

function findLocalNameUsages(
  sourceCode: SourceCode,
  localNames: Set<string>,
): IdentifierUsage[] {
  const usages: IdentifierUsage[] = []

  visitAst(sourceCode.ast, (node, parent) => {
    if (
      node.type !== 'Identifier' ||
      !localNames.has((node as IdentifierNode).name)
    ) {
      return
    }

    usages.push({
      identifier: node as IdentifierNode,
      parent,
    })
  })

  return usages
}

function isIgnoredConfigureUsage(
  usage: IdentifierUsage,
  supportedCalls: Set<CallExpressionNode>,
): boolean {
  const { identifier, parent } = usage
  if (!parent) {
    return false
  }

  if (
    (parent.type === 'ImportSpecifier' ||
      parent.type === 'ImportDefaultSpecifier' ||
      parent.type === 'ImportNamespaceSpecifier') &&
    ((parent as { local?: unknown }).local === identifier ||
      (parent as { imported?: unknown }).imported === identifier)
  ) {
    return true
  }

  if (
    (parent.type === 'Property' ||
      parent.type === 'PropertyDefinition' ||
      parent.type === 'MethodDefinition') &&
    (parent as { key?: unknown; computed?: boolean }).key === identifier &&
    !(parent as { computed?: boolean }).computed
  ) {
    return true
  }

  if (
    parent.type === 'MemberExpression' &&
    (parent as { property?: unknown; computed?: boolean }).property ===
      identifier &&
    !(parent as { computed?: boolean }).computed
  ) {
    return true
  }

  if (
    parent.type === 'CallExpression' &&
    (parent as { callee?: unknown }).callee === identifier &&
    supportedCalls.has(parent as unknown as CallExpressionNode)
  ) {
    return true
  }

  return false
}

function findLegacyTarget(
  sourceCode: SourceCode,
  localNames: Set<string>,
): LegacyTarget | undefined {
  if (localNames.size === 0) {
    return
  }

  const topLevelVariables = new Map<string, TopLevelVariableTarget>()

  for (const statement of sourceCode.ast.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue
    }
    if (
      statement.kind !== 'const' &&
      statement.kind !== 'let' &&
      statement.kind !== 'var'
    ) {
      continue
    }

    for (const declaration of statement.declarations) {
      if (!isIdentifier(declaration.id)) {
        continue
      }
      const call = getCallToLocalNames(declaration.init, localNames)
      if (!call) {
        continue
      }

      topLevelVariables.set(declaration.id.name, { call, kind: statement.kind })
    }
  }

  const exportDefault = sourceCode.ast.body.find(
    statement => statement.type === 'ExportDefaultDeclaration',
  ) as ExportDefaultDeclarationNode | undefined
  if (!exportDefault) {
    return
  }

  const directCall = getCallToLocalNames(exportDefault.declaration, localNames)
  if (directCall) {
    const callee = directCall.callee as { name: string }
    return {
      call: directCall,
      helperLocalName: callee.name,
    }
  }

  const unwrappedDeclaration = unwrapExpression(exportDefault.declaration)
  if (!isIdentifier(unwrappedDeclaration)) {
    return
  }

  const target = topLevelVariables.get(unwrappedDeclaration.name)
  if (!target || target.kind !== 'const' || !isIdentifier(target.call.callee)) {
    return
  }

  return {
    call: target.call,
    helperLocalName: target.call.callee.name,
  }
}

function formatMultilineCall(calleeText: string, argsText: string[]): string {
  if (argsText.length === 0) {
    return `${calleeText}()`
  }

  const formattedArgs = argsText
    .map(arg =>
      arg
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n'),
    )
    .join(',\n')

  return `${calleeText}(\n${formattedArgs},\n)`
}

function buildImportEdits(
  sourceCode: SourceCode,
  imports: ImportDeclarationNode[],
  withVueTsLocalName: string,
): TextEdit[] {
  const primaryImport =
    imports.find(statement =>
      statement.specifiers.some(
        specifier =>
          specifier.type === 'ImportSpecifier' &&
          getImportSpecifierImportedName(specifier) === 'withVueTs',
      ),
    ) ?? imports[0]

  return imports
    .map<TextEdit | undefined>(statement => {
      const keptNamedSpecifiers = statement.specifiers
        .filter(
          specifier =>
            specifier.type === 'ImportSpecifier' &&
            !LEGACY_HELPER_IMPORTS.has(
              getImportSpecifierImportedName(specifier) ?? '',
            ) &&
            getImportSpecifierImportedName(specifier) !== 'configureVueProject',
        )
        .map(specifier => sourceCode.getText(specifier))

      const hasWithVueTsSpecifier = statement.specifiers.some(
        specifier =>
          specifier.type === 'ImportSpecifier' &&
          getImportSpecifierImportedName(specifier) === 'withVueTs',
      )

      if (statement === primaryImport && !hasWithVueTsSpecifier) {
        keptNamedSpecifiers.unshift(
          withVueTsLocalName === 'withVueTs'
            ? 'withVueTs'
            : `withVueTs as ${withVueTsLocalName}`,
        )
      }

      if (keptNamedSpecifiers.length === 0) {
        return {
          range: getStatementRemovalRange(sourceCode, statement),
          text: '',
        }
      }

      const statementText = sourceCode.getText(statement)
      const semicolon = statementText.trimEnd().endsWith(';') ? ';' : ''

      return {
        range: getRequiredRange(statement),
        text: `import { ${keptNamedSpecifiers.join(', ')} } from ${sourceCode.getText(statement.source)}${semicolon}`,
      }
    })
    .filter((edit): edit is TextEdit => !!edit)
}

function classifyFirstArgument(
  call: CallExpressionNode,
): FirstArgumentClassification {
  const firstArg = unwrapExpression(call.arguments[0])
  if (
    !firstArg ||
    typeof firstArg !== 'object' ||
    Array.isArray(firstArg) ||
    (firstArg as { type?: string }).type !== 'ObjectExpression'
  ) {
    return 'config'
  }

  const properties = (
    firstArg as {
      properties: Array<
        | { type: 'SpreadElement' }
        | {
            type: 'Property'
            computed?: boolean
            key: { type?: string; name?: string; value?: string }
          }
      >
    }
  ).properties

  let sawProjectOptionKey = false
  let sawNonProjectOptionKey = false
  let sawAmbiguousProperty = false

  for (const property of properties) {
    if (property.type === 'SpreadElement') {
      sawAmbiguousProperty = true
      continue
    }

    if (property.type !== 'Property' || property.computed) {
      sawAmbiguousProperty = true
      continue
    }

    let propertyName: string | undefined
    if (property.key.type === 'Identifier') {
      propertyName = property.key.name
    } else if (
      property.key.type === 'Literal' &&
      typeof property.key.value === 'string'
    ) {
      propertyName = property.key.value
    }

    if (!propertyName) {
      sawAmbiguousProperty = true
      continue
    }

    if (PROJECT_OPTIONS_KEYS.has(propertyName)) {
      sawProjectOptionKey = true
    } else {
      sawNonProjectOptionKey = true
    }
  }

  if (sawProjectOptionKey && !sawNonProjectOptionKey && !sawAmbiguousProperty) {
    return 'options'
  }

  if (sawProjectOptionKey || sawAmbiguousProperty) {
    return 'ambiguous-options'
  }

  return 'config'
}

export function analyzeToWithVueTsMigrationText(
  text: string,
  filename: string,
): ToWithVueTsMigrationAnalysis {
  const parsed = parseSourceCode(text, filename)
  if (!parsed.sourceCode) {
    return {
      status: 'parse-error',
      reason: parsed.error ?? 'Unknown parser error.',
    }
  }

  return analyzeToWithVueTsMigrationSourceCode(parsed.sourceCode)
}

export function analyzeToWithVueTsMigrationSourceCode(
  sourceCode: SourceCode,
): ToWithVueTsMigrationAnalysis {
  const facts = collectMigrationFacts(sourceCode)
  if (facts.imports.declarations.length === 0) {
    return { status: 'noop' }
  }

  const structuralUnsupportedReasons = getStructuralUnsupportedReasons(
    sourceCode,
    facts,
  )
  if (structuralUnsupportedReasons.length > 0) {
    return {
      status: 'unsupported',
      reasons: structuralUnsupportedReasons,
    }
  }

  if (!facts.legacyTarget) {
    return { status: 'noop' }
  }

  if (isAlreadyUsingWithVueTs(facts)) {
    return { status: 'noop' }
  }

  const callUnsupportedReason = getLegacyCallUnsupportedReason(
    facts.legacyTarget.call,
  )
  if (callUnsupportedReason) {
    return {
      status: 'unsupported',
      reasons: [callUnsupportedReason],
    }
  }

  return buildFixableMigrationAnalysis(sourceCode, {
    ...facts,
    legacyTarget: facts.legacyTarget,
  })
}

function collectMigrationFacts(sourceCode: SourceCode): MigrationFacts {
  const imports = collectVueImports(sourceCode)

  return {
    imports,
    configureStatements: findConfigureVueProjectStatements(
      sourceCode,
      imports.configureVueProjectLocalNames,
    ),
    legacyTarget: findLegacyTarget(sourceCode, imports.legacyHelperLocalNames),
  }
}

function getStructuralUnsupportedReasons(
  sourceCode: SourceCode,
  facts: MigrationFacts,
): string[] {
  return [
    ...new Set([
      ...facts.imports.unsupportedReasons,
      ...getConfigureVueProjectUnsupportedReasons(sourceCode, facts),
      ...getLegacyTargetUnsupportedReasons(facts),
    ]),
  ]
}

function getConfigureVueProjectUnsupportedReasons(
  sourceCode: SourceCode,
  facts: MigrationFacts,
): string[] {
  const reasons: string[] = []
  const configureUsages = findLocalNameUsages(
    sourceCode,
    facts.imports.configureVueProjectLocalNames,
  )
  const supportedConfigureCalls = new Set(
    facts.configureStatements.map(
      configureStatement => configureStatement.call,
    ),
  )

  if (
    configureUsages.some(
      usage => !isIgnoredConfigureUsage(usage, supportedConfigureCalls),
    )
  ) {
    reasons.push(
      'Only top-level `configureVueProject(...)` calls are supported by this migration.',
    )
  }
  if (facts.configureStatements.length > 1) {
    reasons.push(
      'Multiple `configureVueProject()` calls are not supported by this migration.',
    )
  }

  return reasons
}

function getLegacyTargetUnsupportedReasons(facts: MigrationFacts): string[] {
  const reasons: string[] = []

  if (facts.imports.legacyHelperLocalNames.size > 0 && !facts.legacyTarget) {
    reasons.push(
      '`defineConfigWithVueTs()` must be exported directly, or assigned to a top-level variable that is exported as default, for this migration to rewrite it safely.',
    )
  }
  if (facts.configureStatements.length > 0 && !facts.legacyTarget) {
    reasons.push(
      '`configureVueProject()` was found, but this file does not export `defineConfigWithVueTs()`. Manual migration is required.',
    )
  }
  return reasons
}

function isAlreadyUsingWithVueTs(facts: MigrationFacts): boolean {
  return (
    !!facts.legacyTarget &&
    !!facts.imports.withVueTsLocalName &&
    facts.imports.withVueTsLocalName === facts.legacyTarget.helperLocalName
  )
}

function getLegacyCallUnsupportedReason(
  call: CallExpressionNode,
): string | undefined {
  const firstArgumentKind = classifyFirstArgument(call)
  if (firstArgumentKind === 'options') {
    return '`defineConfigWithVueTs()` does not accept project options. This file appears to be partially migrated already.'
  }
  if (firstArgumentKind === 'ambiguous-options') {
    return 'The first argument to `defineConfigWithVueTs()` could be reinterpreted as `withVueTs()` project options. Please migrate this case manually.'
  }
}

function buildFixableMigrationAnalysis(
  sourceCode: SourceCode,
  facts: FixableMigrationFacts,
): ToWithVueTsMigrationAnalysis {
  const withVueTsLocalName = facts.imports.withVueTsLocalName ?? 'withVueTs'
  const configureArgText = getConfigureVueProjectOptionsText(
    sourceCode,
    facts.configureStatements[0],
  )
  const replacementArgs = getWithVueTsReplacementArgs(
    sourceCode,
    facts.legacyTarget,
    configureArgText,
  )
  const edits = buildMigrationEdits(
    sourceCode,
    facts,
    withVueTsLocalName,
    replacementArgs,
  )
  const changes = getMigrationChanges(
    facts.legacyTarget.helperLocalName,
    withVueTsLocalName,
    configureArgText,
  )

  return {
    status: 'fixable',
    changes,
    edits,
  }
}

function getConfigureVueProjectOptionsText(
  sourceCode: SourceCode,
  configureStatement: ConfigureVueProjectStatement | undefined,
): string | undefined {
  const firstArg = configureStatement?.call.arguments[0]
  return firstArg === undefined ? undefined : getNodeText(sourceCode, firstArg)
}

function getWithVueTsReplacementArgs(
  sourceCode: SourceCode,
  legacyTarget: LegacyTarget,
  configureArgText: string | undefined,
): string[] {
  return [
    ...(configureArgText ? [configureArgText] : []),
    ...legacyTarget.call.arguments.map(argument =>
      getNodeText(sourceCode, argument),
    ),
  ]
}

function buildMigrationEdits(
  sourceCode: SourceCode,
  facts: FixableMigrationFacts,
  withVueTsLocalName: string,
  replacementArgs: string[],
): TextEdit[] {
  const edits: TextEdit[] = [
    {
      range: getRequiredRange(facts.legacyTarget.call),
      text: formatMultilineCall(withVueTsLocalName, replacementArgs),
    },
    ...buildImportEdits(
      sourceCode,
      facts.imports.declarations,
      withVueTsLocalName,
    ),
  ]

  if (facts.configureStatements[0]) {
    edits.push({
      range: getStatementRemovalRange(
        sourceCode,
        facts.configureStatements[0].statement,
      ),
      text: '',
    })
  }

  return edits.sort((a, b) => a.range[0] - b.range[0])
}

function getMigrationChanges(
  legacyHelperLocalName: string,
  withVueTsLocalName: string,
  configureArgText: string | undefined,
): string[] {
  return [
    `replace \`${legacyHelperLocalName}(...)\` with \`${withVueTsLocalName}(...)\``,
    'rewrite imports from `@vue/eslint-config-typescript`',
    ...(configureArgText
      ? ['inline `configureVueProject(...)` options into `withVueTs(...)`']
      : []),
  ]
}

const migrateToWithVueTsRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'migrate legacy @vue/eslint-config-typescript helper usage to withVueTs',
    },
    schema: [],
    messages: {
      migrate:
        'Legacy @vue/eslint-config-typescript helper usage can be migrated to `withVueTs(...)`.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const analysis = analyzeToWithVueTsMigrationSourceCode(
          context.sourceCode,
        )
        if (analysis.status !== 'fixable') {
          return
        }

        context.report({
          node,
          messageId: 'migrate',
          fix(fixer) {
            return analysis.edits.map(edit =>
              fixer.replaceTextRange(edit.range, edit.text),
            )
          },
        })
      },
    }
  },
}

function getFixConfig(filename: string): Linter.Config[] {
  return [
    {
      ...getBaseConfig(filename)[0],
      plugins: {
        [MIGRATION_PLUGIN_NAME]: {
          rules: {
            [MIGRATION_RULE_NAME]: migrateToWithVueTsRule,
          },
        },
      },
      rules: {
        [MIGRATION_RULE_ID]: 'error',
      },
    },
  ]
}

export function applyToWithVueTsMigrationText(
  text: string,
  filename: string,
): AppliedToWithVueTsMigration {
  const analysis = analyzeToWithVueTsMigrationText(text, filename)
  if (analysis.status !== 'fixable') {
    return {
      analysis,
      changed: false,
      output: text,
    }
  }

  const linter = new Linter({ configType: 'flat' })
  const lintFilename = getLintFilename(filename)
  const report = linter.verifyAndFix(text, getFixConfig(lintFilename), {
    filename: lintFilename,
  })

  return {
    analysis,
    changed: report.fixed,
    output: report.output ?? text,
  }
}
