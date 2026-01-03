/**
 * Post-build patch for ESM runtime compatibility.
 *
 * Problem:
 * - Our packages are ESM ("type": "module"), and Node ESM requires explicit file extensions
 *   for relative imports (e.g. `./foo.js`), but TypeScript emits extensionless specifiers.
 *
 * Constraint:
 * - Next.js (and TS in general) does NOT like `.js` extensions in TS source paths when the
 *   files are `.ts/.tsx` in a workspace, so we keep TS source extensionless for dev/build.
 *
 * Solution:
 * - After `tsc`, rewrite emitted JS files under `dist/` to append `.js` to relative imports/exports
 *   that don't already have an extension.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../');
}

function hasExtension(spec) {
  return /\.[a-zA-Z0-9]+$/.test(spec);
}

function rewriteFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');

  // Rewrite:
  //   from './x'   -> from './x.js'
  //   from '../y'  -> from '../y.js'
  // But DO NOT touch:
  //   from './x.js' / './x.json' / './x.node' etc
  //   from 'react' / '@scope/pkg'
  const out = src.replace(
    /(from\s+['"])([^'"]+)(['"])/g,
    (m, p1, spec, p3) => {
      if (!isRelative(spec)) return m;
      if (hasExtension(spec)) return m;
      return `${p1}${spec}.js${p3}`;
    }
  ).replace(
    /(export\s+\*\s+from\s+['"])([^'"]+)(['"])/g,
    (m, p1, spec, p3) => {
      if (!isRelative(spec)) return m;
      if (hasExtension(spec)) return m;
      return `${p1}${spec}.js${p3}`;
    }
  );

  if (out !== src) fs.writeFileSync(filePath, out, 'utf8');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && full.endsWith('.js')) rewriteFile(full);
  }
}

if (fs.existsSync(distDir)) {
  walk(distDir);
  // eslint-disable-next-line no-console
  console.log(`[fix-esm-specifiers] patched dist js imports in ${distDir}`);
}


