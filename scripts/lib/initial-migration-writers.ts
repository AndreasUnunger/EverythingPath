import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';

const rawBuilders = new Set([
  'mutation',
  'internalMutation',
  'action',
  'internalAction',
  'httpAction',
  'mutationGeneric',
  'internalMutationGeneric',
  'actionGeneric',
  'internalActionGeneric',
  'httpActionGeneric',
]);
const gatedBuilders = new Set([
  'gatedMutation',
  'gatedInternalMutation',
  'gatedWebhookMutation',
  'campaignMutation',
  'campaignInternalMutation',
]);
const reviewed: Record<string, string> = {
  'convex/initialMigration.ts:start':
    'Operator: atomically closes the gate and records the run',
  'convex/initialMigration.ts:abortBeforeActivation':
    'Operator: reopens only the current unactivated run and advances the epoch',
  'convex/canonicalDraftPersistence.ts:retireClosedDraft':
    'Write gate (maintenance defers); accepted draft retirement is idempotent across epochs and Character authority',
  'convex/canonicalPersistenceFixtures.ts:inspect':
    'Read-only fixture inspection; no writes or scheduling',
  'convex/clerk.ts:fulfill':
    'Signature verification only; no writes or scheduling',
  'convex/http.ts:httpAction#1':
    'Webhook: verifies signature before database access; delegates to gated user mutations with signed event time',
};

type Writer = { name: string; policy: string };

function propertyValue(node: ts.Node | undefined, name: string) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  const property = node.properties.find(
    (entry) => ts.isPropertyAssignment(entry) && entry.name.getText() === name,
  );
  return property && ts.isPropertyAssignment(property)
    ? property.initializer
    : undefined;
}

function acceptsWriteEpoch(options: ts.Node | undefined, retired: boolean) {
  const args = propertyValue(options, 'args');
  if (retired && args?.getText() === 'v.any()') return true;
  return (
    propertyValue(args, 'writeEpoch')?.getText().replace(/\s/g, '') ===
    'v.optional(v.number())'
  );
}

type ImportedName = { name: string; module: string };
type Imports = {
  names: Map<string, ImportedName>;
  namespaces: Map<string, string>;
};

function collectImports(ast: ts.SourceFile): Imports {
  const names = new Map<string, ImportedName>();
  const namespaces = new Map<string, string>();
  for (const node of ast.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const module = node.moduleSpecifier.text.startsWith('.')
      ? posix.normalize(
          posix.join(posix.dirname(ast.fileName), node.moduleSpecifier.text),
        )
      : node.moduleSpecifier.text;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const entry of bindings.elements)
        names.set(entry.name.text, {
          name: entry.propertyName?.text ?? entry.name.text,
          module,
        });
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, module);
    }
  }
  return { names, namespaces };
}

function resolveImport(
  node: ts.Node,
  imports: Imports,
): ImportedName | undefined {
  if (ts.isIdentifier(node)) return imports.names.get(node.text);
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression))
    return undefined;
  const module = imports.namespaces.get(node.expression.text);
  return module === undefined ? undefined : { name: node.name.text, module };
}

function isBuilder(imported: ImportedName | undefined) {
  return (
    imported &&
    (rawBuilders.has(imported.name) || gatedBuilders.has(imported.name))
  );
}

function isDirectCall(node: ts.Node) {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

function checkEscapes(
  node: ts.Node,
  imports: Imports,
  path: string,
  errors: string[],
) {
  if (
    path === 'convex/lib/writeGate.ts' ||
    path === 'convex/lib/campaignRuntime.ts'
  )
    return;
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    const imported = resolveImport(node, imports);
    if (imported && isBuilder(imported) && !isDirectCall(node))
      errors.push(
        `${path} raw builder ${imported.name} escapes a direct registration`,
      );
  }
  if (
    ts.isIdentifier(node) &&
    imports.namespaces.has(node.text) &&
    !(
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.expression === node
    )
  )
    errors.push(`${path} server namespace escapes a direct registration`);
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  )
    errors.push(`${path} re-exports require explicit writer review`);
}

function classifyRegistration(
  imported: ImportedName,
  retired: boolean,
  name: string,
) {
  if (imported.module === 'convex/lib/writeGate') {
    switch (imported.name) {
      case 'gatedMutation':
      case 'gatedInternalMutation':
        return 'Shared write gate (epoch + maintenance)';
      case 'gatedWebhookMutation':
        return 'Write gate (maintenance + legacy authority); idempotent webhook, epoch exempt';
    }
  }
  if (
    imported.module === 'convex/lib/campaignRuntime' &&
    ['campaignMutation', 'campaignInternalMutation'].includes(imported.name)
  )
    return 'Shared write gate (epoch + maintenance)';
  return retired ? 'Retired: always rejects; never mutates' : reviewed[name];
}

function checkRegistration(
  node: ts.CallExpression,
  imported: ImportedName,
  imports: Imports,
  name: string,
  errors: string[],
): Writer {
  const options = node.arguments[0];
  const handler = propertyValue(options, 'handler');
  const rejection =
    handler && ts.isIdentifier(handler)
      ? imports.names.get(handler.text)
      : undefined;
  const retired =
    rejection?.name === 'rejectRetiredWorkflow' &&
    rejection.module === 'convex/lib/retiredWorkflow';
  const policy = classifyRegistration(imported, retired, name);
  if (!policy) errors.push(`${name} is not gated or a reviewed exception`);
  if (
    ['mutation', 'mutationGeneric'].includes(imported.name) &&
    !acceptsWriteEpoch(options, retired)
  )
    errors.push(`${name} public mutation must accept optional writeEpoch`);
  if (
    (policy?.startsWith('Read-only') || policy?.startsWith('Signature')) &&
    /\.(insert|patch|replace|delete|runMutation|runAfter|runAt)\s*\(/.test(
      node.getText(),
    )
  )
    errors.push(`${name} read-only exception now writes or schedules work`);
  return { name, policy: policy ?? 'UNGATED' };
}

function auditSource(
  path: string,
  source: string,
  writers: Writer[],
  errors: string[],
) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = collectImports(ast);
  let anonymous = 0;
  function visit(node: ts.Node, parentOwner?: string) {
    if (ts.isImportDeclaration(node)) return;
    checkEscapes(node, imports, path, errors);
    const owner =
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        ? node.name.text
        : parentOwner;
    if (ts.isCallExpression(node)) {
      const imported = resolveImport(node.expression, imports);
      if (imported && isBuilder(imported)) {
        const name = `${path}:${owner ?? `${imported.name}#${++anonymous}`}`;
        writers.push(checkRegistration(node, imported, imports, name, errors));
      }
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(ast);
}

export function auditWriters(sources: Record<string, string>) {
  const writers: Writer[] = [];
  const errors: string[] = [];
  for (const [path, source] of Object.entries(sources).sort())
    auditSource(path, source, writers, errors);
  writers.sort((a, b) => a.name.localeCompare(b.name));
  return { writers, errors };
}

export function readWriterSources(root: string) {
  const sources: Record<string, string> = {};
  function walk(directory: string) {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_generated') walk(path);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
        sources[path] = readFileSync(join(root, path), 'utf8');
    }
  }
  walk('convex');
  return sources;
}

export function writerInventory(writers: Writer[]) {
  return [
    '| Registered writer | Gate or reviewed exception |',
    '| --- | --- |',
    ...writers.map(({ name, policy }) => `| \`${name}\` | ${policy} |`),
  ].join('\n');
}
