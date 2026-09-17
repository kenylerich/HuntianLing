import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';
import ts from 'typescript';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function checkManifestAndImports(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const errors = [];
  if (manifest.type !== 'module') errors.push('package must use ESM');
  if (!manifest.exports?.['.']?.types || !manifest.exports?.['.']?.default) errors.push('root export needs types and default entries');
  if (!manifest.engines?.node) errors.push('package must declare supported Node versions');
  const runtime = new Set([manifest.name, ...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]);
  const development = new Set([...runtime, ...Object.keys(manifest.devDependencies ?? {})]);
  function walk(path, allowed) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) walk(file, allowed);
      else if (/\.(ts|mjs)$/.test(entry.name)) {
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node) {
          const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
            : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
              : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
          if (specifier && ts.isStringLiteralLike(specifier)) {
            const name = specifier.text;
            if (!name.startsWith('.') && !isBuiltin(name)) {
              const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
              if (!allowed.has(packageName)) errors.push(`${relative(directory, file)}: undeclared dependency ${packageName}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  walk(join(directory, 'src'), runtime);
  walk(join(directory, 'scripts'), development);
  walk(join(directory, 'test'), development);
  return errors;
}

async function main() {
  const errors = checkManifestAndImports(root);
  const { messages, pkg } = await publint({ pkgDir: root, pack: 'npm' });
  for (const message of messages) errors.push(formatMessage(message, pkg));
  const compiler = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.node-next.json'], {
    cwd: root, stdio: 'inherit',
  });
  if (compiler.error || compiler.status !== 0) errors.push('NodeNext source check failed');
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
  else console.log('Package exports, declared dependencies, and NodeNext source checks passed.');
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) await main();
