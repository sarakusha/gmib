#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const declarationFiles = [
  path.join(repositoryRoot, 'packages/preload/gmibInMainWorld.d.ts'),
  path.join(repositoryRoot, 'packages/preload/playerInMainWorld.d.ts'),
];

for (const declarationFile of declarationFiles) {
  if (!fs.existsSync(declarationFile)) continue;
  const declarationDirectory = path.dirname(declarationFile);
  const original = fs.readFileSync(declarationFile, 'utf8');
  const normalized = original.replace(/import\(\"([^\"]+)\"\)/g, (match, specifier) => {
    if (!path.isAbsolute(specifier)) return match;
    const relative = path.relative(declarationDirectory, specifier).replaceAll(path.sep, '/');
    return `import(\"${relative.startsWith('.') ? relative : `./${relative}`}\")`;
  });
  if (normalized !== original) fs.writeFileSync(declarationFile, normalized);
}
