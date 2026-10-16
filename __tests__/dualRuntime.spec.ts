import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

import * as esbuild from 'esbuild'
import ts from 'typescript'

/**
 * Public packages must load in both browsers and Node.
 * Library source therefore cannot import Node built-ins, and every value
 * reference to a global that exists on only one side must be guarded.
 */

const ROOT = path.resolve(__dirname, '..')

const NODE_ONLY_GLOBALS = [
  'process',
  'Buffer',
  '__dirname',
  '__filename',
  'setImmediate',
  'global'
]

const BROWSER_ONLY_GLOBALS = [
  'window',
  'document',
  'self',
  'localStorage',
  'sessionStorage',
  'location',
  'DOMParser',
  'XMLHttpRequest',
  'ProgressEvent',
  'FileReader',
  'Worker',
  'SharedWorker',
  'OffscreenCanvas',
  'HTMLCanvasElement',
  'ImageData',
  'Path2D',
  'createImageBitmap',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Image'
]

const SENSITIVE_GLOBALS = new Set([
  ...NODE_ONLY_GLOBALS,
  ...BROWSER_ONLY_GLOBALS
])

const WORKSPACE_ALIASES: Record<string, string> = {
  '@mlightcad/common': 'packages/common/src/index.ts',
  '@mlightcad/geometry-engine': 'packages/geometry-engine/src/index.ts',
  '@mlightcad/graphic-interface': 'packages/graphic-interface/src/index.ts',
  '@mlightcad/emf-converter': 'packages/emf-converter/src/index.ts',
  '@mlightcad/data-model': 'packages/data-model/src/index.ts',
  '@mlightcad/libredwg-converter': 'packages/libredwg-converter/src/index.ts'
}

interface PublicPackage {
  name: string
  dir: string
  entry: string
}

interface Scope {
  names: Set<string>
  parent?: Scope
}

function isOutsideThisRepo(dir: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', dir], {
      cwd: ROOT,
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

function listPublicPackages(): PublicPackage[] {
  const packagesDir = path.join(ROOT, 'packages')
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => !isOutsideThisRepo(path.join(packagesDir, entry.name)))
    .map(entry => {
      const dir = path.join(packagesDir, entry.name)
      const manifestPath = path.join(dir, 'package.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        name?: string
        private?: boolean
      }
      return {
        name: manifest.name ?? entry.name,
        dir,
        entry: path.join(dir, 'src', 'index.ts'),
        private: manifest.private === true
      }
    })
    .filter(pkg => !pkg.private)
    .map(({ name, dir, entry }) => ({ name, dir, entry }))
}

function listLibrarySources(dir: string): string[] {
  const srcDir = path.join(dir, 'src')
  const files: string[] = []
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === '__fixtures__')
          continue
        visit(fullPath)
        continue
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
        continue
      }
      files.push(fullPath)
    }
  }
  visit(srcDir)
  return files
}

function isNodeBuiltin(specifier: string): boolean {
  const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier
  return (
    builtinModules.includes(bare) || builtinModules.includes(`node:${bare}`)
  )
}

function isDeclared(scope: Scope | undefined, name: string): boolean {
  for (let current = scope; current; current = current.parent) {
    if (current.names.has(name)) return true
  }
  return false
}

function addBindingName(
  name: ts.BindingName | ts.PropertyName | undefined,
  names: Set<string>
) {
  if (!name) return
  if (ts.isIdentifier(name)) {
    names.add(name.text)
    return
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name, names)
    }
  }
}

function isInTypePosition(node: ts.Node): boolean {
  let current = node.parent
  while (current) {
    if (ts.isTypeNode(current) || ts.isHeritageClause(current)) return true
    current = current.parent
  }
  return false
}

function isPropertyOrDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent
  if (!parent) return false
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true
  if (ts.isPropertySignature(parent) && parent.name === node) return true
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true
  if (ts.isMethodSignature(parent) && parent.name === node) return true
  if (ts.isEnumMember(parent) && parent.name === node) return true
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true
  if (ts.isImportSpecifier(parent)) return true
  if (ts.isExportSpecifier(parent)) return true
  if (ts.isNamespaceImport(parent) && parent.name === node) return true
  if (
    (ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionExpression(parent)) &&
    parent.name === node
  ) {
    return true
  }
  return false
}

function isTypeofOperand(node: ts.Identifier): boolean {
  return ts.isTypeOfExpression(node.parent) && node.parent.expression === node
}

function typeofName(expression: ts.Expression, name: string): boolean {
  return (
    ts.isTypeOfExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === name
  )
}

function isPresenceCheck(expression: ts.Expression, name: string): boolean {
  if (ts.isParenthesizedExpression(expression)) {
    return isPresenceCheck(expression.expression, name)
  }
  if (!ts.isBinaryExpression(expression)) return false
  const operator = expression.operatorToken.kind
  if (
    operator === ts.SyntaxKind.AmpersandAmpersandToken ||
    operator === ts.SyntaxKind.BarBarToken
  ) {
    return (
      isPresenceCheck(expression.left, name) ||
      isPresenceCheck(expression.right, name)
    )
  }
  if (
    !typeofName(expression.left, name) ||
    !ts.isStringLiteral(expression.right)
  ) {
    return false
  }
  if (
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
    expression.right.text === 'undefined'
  ) {
    return true
  }
  return (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    (expression.right.text === 'function' || expression.right.text === 'object')
  )
}

function isAbsenceCheck(expression: ts.Expression, name: string): boolean {
  if (ts.isParenthesizedExpression(expression)) {
    return isAbsenceCheck(expression.expression, name)
  }
  if (!ts.isBinaryExpression(expression)) return false
  if (expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    return (
      isAbsenceCheck(expression.left, name) ||
      isAbsenceCheck(expression.right, name)
    )
  }
  if (
    !typeofName(expression.left, name) ||
    !ts.isStringLiteral(expression.right)
  ) {
    return false
  }
  const operator = expression.operatorToken.kind
  if (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    expression.right.text === 'undefined'
  ) {
    return true
  }
  return (
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
    (expression.right.text === 'function' || expression.right.text === 'object')
  )
}

function statementAborts(statement: ts.Statement | undefined): boolean {
  if (!statement) return false
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    return true
  }
  if (ts.isBlock(statement)) {
    return statementAborts(
      statement.statements[statement.statements.length - 1]
    )
  }
  if (ts.isIfStatement(statement) && statement.elseStatement) {
    return (
      statementAborts(statement.thenStatement) &&
      statementAborts(statement.elseStatement)
    )
  }
  return false
}

function isEarlyGuard(statement: ts.Statement, name: string): boolean {
  return (
    ts.isIfStatement(statement) &&
    statement.elseStatement === undefined &&
    isAbsenceCheck(statement.expression, name) &&
    statementAborts(statement.thenStatement)
  )
}

function hasEarlyGuard(identifier: ts.Identifier, name: string): boolean {
  let current: ts.Node = identifier
  while (current.parent) {
    const parent = current.parent
    if (
      ts.isBlock(parent) ||
      ts.isSourceFile(parent) ||
      ts.isModuleBlock(parent)
    ) {
      const index = parent.statements.indexOf(current as ts.Statement)
      if (index > 0) {
        for (let i = 0; i < index; i++) {
          if (isEarlyGuard(parent.statements[i], name)) return true
        }
      }
    }
    current = parent
  }
  return false
}

function isGuarded(identifier: ts.Identifier): boolean {
  const name = identifier.text
  if (hasEarlyGuard(identifier, name)) return true

  let child: ts.Node = identifier
  let parent = identifier.parent
  while (parent) {
    if (
      ts.isIfStatement(parent) &&
      parent.expression !== child &&
      isPresenceCheck(parent.expression, name) &&
      (parent.thenStatement === child || parent.elseStatement === child)
    ) {
      return true
    }
    if (
      ts.isConditionalExpression(parent) &&
      parent.condition !== child &&
      isPresenceCheck(parent.condition, name) &&
      (parent.whenTrue === child || parent.whenFalse === child)
    ) {
      return true
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      parent.right === child &&
      isPresenceCheck(parent.left, name)
    ) {
      return true
    }
    child = parent
    parent = parent.parent
  }
  return false
}

function collectScopeNames(node: ts.Node, names: Set<string>) {
  if (ts.isSourceFile(node) || ts.isModuleBlock(node) || ts.isBlock(node)) {
    node.statements.forEach(statement => {
      if (ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach(declaration =>
          addBindingName(declaration.name, names)
        )
      } else if (ts.isFunctionDeclaration(statement) && statement.name) {
        names.add(statement.name.text)
      } else if (ts.isClassDeclaration(statement) && statement.name) {
        names.add(statement.name.text)
      } else if (ts.isEnumDeclaration(statement)) {
        names.add(statement.name.text)
      } else if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause
        if (clause.name) names.add(clause.name.text)
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            names.add(clause.namedBindings.name.text)
          } else {
            clause.namedBindings.elements.forEach(element =>
              names.add(element.name.text)
            )
          }
        }
      }
    })
  }

  if (ts.isFunctionLike(node)) {
    node.parameters.forEach(parameter => addBindingName(parameter.name, names))
    if (ts.isFunctionDeclaration(node) && node.name) names.add(node.name.text)
  }

  if (ts.isCatchClause(node) && node.variableDeclaration) {
    addBindingName(node.variableDeclaration.name, names)
  }

  if (
    (ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForStatement(node)) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    node.initializer.declarations.forEach(declaration =>
      addBindingName(declaration.name, names)
    )
  }

  if (ts.isClassLike(node)) {
    node.members.forEach(member => {
      if (
        (ts.isMethodDeclaration(member) ||
          ts.isPropertyDeclaration(member) ||
          ts.isGetAccessor(member) ||
          ts.isSetAccessor(member)) &&
        member.name &&
        ts.isIdentifier(member.name)
      ) {
        names.add(member.name.text)
      }
    })
  }
}

function createsScope(node: ts.Node): boolean {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isFunctionLike(node) ||
    ts.isCatchClause(node) ||
    ts.isClassLike(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForStatement(node)
  )
}

function scanSource(filePath: string): string[] {
  const text = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const violations: string[] = []
  const relativePath = path.relative(ROOT, filePath)

  const report = (node: ts.Node, message: string) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    violations.push(
      `${relativePath}:${position.line + 1}:${position.character + 1} ${message}`
    )
  }

  const visit = (node: ts.Node, scope: Scope) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isNodeBuiltin(node.moduleSpecifier.text)
    ) {
      report(
        node.moduleSpecifier,
        `imports Node.js builtin "${node.moduleSpecifier.text}"`
      )
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      isNodeBuiltin(node.arguments[0].text)
    ) {
      report(node, `imports Node.js builtin "${node.arguments[0].text}"`)
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      !isDeclared(scope, 'require') &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      isNodeBuiltin(node.arguments[0].text)
    ) {
      report(node, `requires Node.js builtin "${node.arguments[0].text}"`)
    }

    if (
      ts.isIdentifier(node) &&
      SENSITIVE_GLOBALS.has(node.text) &&
      !isInTypePosition(node) &&
      !isPropertyOrDeclarationName(node) &&
      !isTypeofOperand(node) &&
      !isDeclared(scope, node.text) &&
      !isGuarded(node)
    ) {
      report(
        node,
        `uses "${node.text}" without a runtime guard, so this file cannot load in both browsers and Node`
      )
    }

    const nextScope = createsScope(node)
      ? { names: new Set<string>(), parent: scope }
      : scope
    if (nextScope !== scope) collectScopeNames(node, nextScope.names)
    ts.forEachChild(node, child => visit(child, nextScope))
  }

  visit(sourceFile, { names: new Set() })
  return violations
}

function banNodeBuiltins(): esbuild.Plugin {
  return {
    name: 'ban-node-builtins',
    setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (!isNodeBuiltin(args.path)) return undefined
        return {
          errors: [
            {
              text: `Node.js builtin "${args.path}" cannot be imported from a browser/Node package`
            }
          ]
        }
      })
    }
  }
}

async function bundleEntry(entry: string): Promise<string> {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    packages: 'external',
    alias: Object.fromEntries(
      Object.entries(WORKSPACE_ALIASES).map(([name, relativePath]) => [
        name,
        path.join(ROOT, relativePath)
      ])
    ),
    plugins: [banNodeBuiltins()]
  })
  return result.outputFiles[0].text
}

function evaluateBundle(code: string, runtime: 'browser' | 'node') {
  const filename = path.join(ROOT, 'dual-runtime-entry.cjs')
  const localRequire = createRequire(filename)
  const sandboxRequire = (id: string) => {
    if (id === '@mlightcad/libredwg-web') return {}
    return localRequire(id)
  }
  const module = { exports: {} as Record<string, unknown> }
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    fetch,
    Blob,
    Headers,
    Request,
    Response,
    ReadableStream,
    AbortController,
    performance,
    crypto,
    btoa,
    atob,
    structuredClone,
    Event,
    EventTarget,
    MessageChannel,
    navigator,
    module,
    exports: module.exports,
    require: sandboxRequire
  }

  for (const name of SENSITIVE_GLOBALS) sandbox[name] = undefined
  if (runtime === 'node') {
    sandbox.process = process
    sandbox.Buffer = Buffer
    sandbox.setImmediate = setImmediate
    sandbox.global = sandbox
  }
  sandbox.globalThis = sandbox

  vm.createContext(sandbox)
  const wrapped = `(function (exports, require, module, __filename, __dirname) {\n${code}\n})`
  const script = new vm.Script(wrapped, { filename })
  const runner = script.runInContext(sandbox) as (
    exports: unknown,
    require: (id: string) => unknown,
    module: { exports: unknown },
    filename: string,
    dirname: string
  ) => void
  runner(module.exports, sandboxRequire, module, filename, ROOT)
  return module.exports
}

describe('browser and Node packages', () => {
  jest.setTimeout(120000)

  const packages = listPublicPackages()

  it('publishes an importable entry for every public package', () => {
    expect(packages.length).toBeGreaterThan(0)
    for (const pkg of packages) {
      expect(fs.existsSync(pkg.entry)).toBe(true)
    }
  })

  it('keeps library source free of single-runtime imports and globals', () => {
    const violations = packages.flatMap(pkg =>
      listLibrarySources(pkg.dir).flatMap(scanSource)
    )
    expect(violations).toEqual([])
  })

  it.each(packages.map(pkg => [pkg.name, pkg.entry] as const))(
    'loads %s with and without Node globals',
    async (_name, entry) => {
      const code = await bundleEntry(entry)
      expect(Object.keys(evaluateBundle(code, 'node')).length).toBeGreaterThan(
        0
      )
      expect(
        Object.keys(evaluateBundle(code, 'browser')).length
      ).toBeGreaterThan(0)
    }
  )
})
