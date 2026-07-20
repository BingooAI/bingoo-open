/**
 * loader-hooks.mjs — a Node ESM resolve hook so the headless verifier can import
 * the REAL engine (TypeScript, `@/` aliases, extensionless relative imports).
 * Node 24 strips types from .ts files automatically; this hook just points the
 * resolver at the right file. Zero dependencies.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(process.cwd(), 'src');
const EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.json'];

function tryResolve(base) {
  if (path.extname(base) && existsSync(base)) return base;
  for (const e of EXTS) if (existsSync(base + e)) return base + e;
  for (const e of EXTS) {
    const idx = path.join(base, 'index' + e);
    if (existsSync(idx)) return idx;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith('@/')) {
    base = path.join(SRC, specifier.slice(2));
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const hit = tryResolve(base);
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return next(specifier, context);
}

/**
 * Transpile TS/TSX with the real `typescript` compiler. Unlike Node's built-in
 * type *stripping*, transpileModule does proper per-file type ELISION, so mixed
 * imports like `import { ease, EasingName }` correctly drop the type-only name.
 */
export async function load(url, context, next) {
  if (url.startsWith('file://') && /\.tsx?$/.test(url)) {
    const file = fileURLToPath(url);
    const source = readFileSync(file, 'utf8');
    const out = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
    });
    return { format: 'module', source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
