import type { SourceCode } from 'eslint'

export type ImportDeclarationNode = SourceCode['ast']['body'][number] & {
  type: 'ImportDeclaration'
}

export type ExpressionStatementNode = SourceCode['ast']['body'][number] & {
  type: 'ExpressionStatement'
}

export type ExportDefaultDeclarationNode = SourceCode['ast']['body'][number] & {
  type: 'ExportDefaultDeclaration'
}

export type CallExpressionNode = {
  type: 'CallExpression'
  callee: unknown
  arguments: unknown[]
  range: [number, number]
}

export type GenericAstNode = {
  type: string
  [key: string]: unknown
  range?: [number, number]
}

export type IdentifierNode = GenericAstNode & {
  type: 'Identifier'
  name: string
}

export type IdentifierUsage = {
  identifier: IdentifierNode
  parent: GenericAstNode | null
}

export type ImportSpecifierNode = ImportDeclarationNode['specifiers'][number]

export function isIdentifier(
  node: unknown,
): node is { type: 'Identifier'; name: string } {
  return (
    !!node &&
    typeof node === 'object' &&
    (node as { type?: string }).type === 'Identifier'
  )
}

export function isCallExpression(node: unknown): node is CallExpressionNode {
  return (
    !!node &&
    typeof node === 'object' &&
    (node as { type?: string }).type === 'CallExpression'
  )
}

export function getRequiredRange(node: {
  range?: [number, number]
}): [number, number] {
  if (!node.range) {
    throw new Error('Expected node to have a range.')
  }

  return node.range
}

function isAstNode(node: unknown): node is GenericAstNode {
  return (
    !!node &&
    typeof node === 'object' &&
    typeof (node as { type?: unknown }).type === 'string'
  )
}

export function unwrapExpression(node: unknown): unknown {
  let current = node

  while (isAstNode(current)) {
    switch (current.type) {
      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        current = (current as unknown as { expression: unknown }).expression
        continue
      default:
        return current
    }
  }

  return current
}

export function getCallToLocalNames(
  node: unknown,
  localNames: Set<string>,
): CallExpressionNode | undefined {
  const unwrappedNode = unwrapExpression(node)
  return isCallExpression(unwrappedNode) &&
    isIdentifier(unwrappedNode.callee) &&
    localNames.has(unwrappedNode.callee.name)
    ? unwrappedNode
    : undefined
}

export function visitAst(
  node: unknown,
  visitor: (node: GenericAstNode, parent: GenericAstNode | null) => void,
  parent: GenericAstNode | null = null,
): void {
  if (!isAstNode(node)) {
    return
  }

  visitor(node, parent)

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visitAst(item, visitor, node)
      }
      continue
    }

    visitAst(value, visitor, node)
  }
}

export function getNodeText(sourceCode: SourceCode, node: unknown): string {
  return sourceCode.getText(node as never)
}

export function getStatementRemovalRange(
  sourceCode: SourceCode,
  statement: { range?: [number, number] },
): [number, number] {
  const text = sourceCode.getText()
  const range = getRequiredRange(statement)
  let start = range[0]
  while (start > 0 && text[start - 1] !== '\n') {
    start--
  }

  let end = range[1]
  while (end < text.length && text[end] !== '\n') {
    end++
  }
  if (text[end] === '\n') {
    end++
  }

  let nextLineEnd = end
  while (nextLineEnd < text.length && text[nextLineEnd] !== '\n') {
    nextLineEnd++
  }

  if (text.slice(end, nextLineEnd).trim() === '') {
    end = nextLineEnd
    if (text[end] === '\n') {
      end++
    }
  }

  return [start, end]
}
