import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'scripts/packaged-runtime-deps.json');
const defaultAsarPath = path.join(root, 'dist/mac-arm64/gmib.app/Contents/Resources/app.asar');

const args = new Set(process.argv.slice(2));
const asarPath =
  process.argv
    .slice(2)
    .find(arg => arg.startsWith('--asar='))
    ?.slice('--asar='.length) ?? defaultAsarPath;
const write = args.has('--write');

const readJsonFile = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJsonFile = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const resolveAsar = async () => {
  try {
    return await import('@electron/asar');
  } catch {
    const pnpmDir = path.join(root, 'node_modules/.pnpm');
    const candidates = fs
      .readdirSync(pnpmDir)
      .filter(name => name.startsWith('@electron+asar@'))
      .sort();
    const candidate = candidates.at(-1);
    if (!candidate) {
      throw new Error('Cannot find @electron/asar. Run pnpm install first.');
    }
    return await import(path.join(pnpmDir, candidate, 'node_modules/@electron/asar/lib/asar.js'));
  }
};

const packageNameFromPath = packageJsonPathInAsar => {
  const parts = packageJsonPathInAsar.split('/').filter(Boolean);
  if (parts[1]?.startsWith('@')) return `${parts[1]}/${parts[2]}`;
  return parts[1];
};

const sortObject = object =>
  Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)));

const addSource = (sources, dependencyName, source) => {
  const values = sources[dependencyName] ?? [];
  if (!values.includes(source)) values.push(source);
  sources[dependencyName] = values.sort();
};

const pickSpec = (name, specs, packageJson, previousManifest) => {
  if (packageJson.dependencies?.[name]) return packageJson.dependencies[name];
  if (previousManifest.dependencies?.[name]) return previousManifest.dependencies[name];
  return [...specs].sort()[0];
};

const asar = await resolveAsar();
const archive = path.resolve(root, asarPath);

if (!fs.existsSync(archive)) {
  throw new Error(`Cannot find app.asar at ${archive}. Run pnpm run compile first.`);
}

const packageJson = readJsonFile(packageJsonPath);
const previousManifest = fs.existsSync(manifestPath)
  ? readJsonFile(manifestPath)
  : { dependencies: {} };
const previousAutoDeps = new Set(Object.keys(previousManifest.dependencies ?? {}));

const files = new Set(asar.listPackage(archive));
const dirs = new Set();

for (const filePath of files) {
  const parts = filePath.split('/').filter(Boolean);
  let current = '';
  for (const part of parts.slice(0, -1)) {
    current += `/${part}`;
    dirs.add(current);
  }
}

const exists = filePath => files.has(filePath) || dirs.has(filePath);

const readAsarJson = filePath => {
  try {
    return JSON.parse(asar.extractFile(archive, filePath.replace(/^\//, '')).toString());
  } catch {
    return undefined;
  }
};

const hasRuntimeDependency = (requesterBasePath, dependencyName) => {
  if (exists(`${requesterBasePath}/node_modules/${dependencyName}`)) return true;
  if (previousAutoDeps.has(dependencyName)) return false;
  return exists(`/node_modules/${dependencyName}`);
};

const packageJsonPaths = [...files].filter(filePath =>
  /^\/node_modules\/(?:@[^/]+\/[^/]+|[^/]+)\/package\.json$/.test(filePath),
);

const wantedSpecs = {};
const sources = {};

for (const dependencyPackageJsonPath of packageJsonPaths) {
  const dependencyPackageJson = readAsarJson(dependencyPackageJsonPath);
  if (!dependencyPackageJson) continue;

  const requesterBasePath = dependencyPackageJsonPath.replace(/\/package\.json$/, '');
  const requesterName = packageNameFromPath(dependencyPackageJsonPath);
  const requesterVersion = dependencyPackageJson.version;

  for (const [dependencyName, spec] of Object.entries(dependencyPackageJson.dependencies ?? {})) {
    if (hasRuntimeDependency(requesterBasePath, dependencyName)) continue;
    wantedSpecs[dependencyName] ??= new Set();
    wantedSpecs[dependencyName].add(spec);
    addSource(
      sources,
      dependencyName,
      `${requesterName}@${requesterVersion ?? 'unknown'} -> ${dependencyName}@${spec}`,
    );
  }
}

const nextAutoDependencies = sortObject(
  Object.fromEntries(
    Object.entries(wantedSpecs).map(([name, specs]) => [
      name,
      pickSpec(name, specs, packageJson, previousManifest),
    ]),
  ),
);

const nextManifest = {
  comment:
    'Automatically maintained by scripts/sync-packaged-deps.mjs. These packages are hoisted runtime deps needed by the packaged app.asar when using pnpm.',
  asar: path.relative(root, archive),
  dependencies: nextAutoDependencies,
  sources: sortObject(sources),
};

const changes = [];
packageJson.dependencies ??= {};

for (const [name, previousSpec] of Object.entries(previousManifest.dependencies ?? {})) {
  if (name in nextAutoDependencies) continue;
  if (packageJson.dependencies[name] === previousSpec) {
    delete packageJson.dependencies[name];
    changes.push(`remove ${name}`);
  } else if (packageJson.dependencies[name]) {
    changes.push(`keep ${name} because package.json has ${packageJson.dependencies[name]}`);
  }
}

for (const [name, spec] of Object.entries(nextAutoDependencies)) {
  if (packageJson.dependencies[name] === spec) continue;
  packageJson.dependencies[name] = spec;
  changes.push(`${packageJson.dependencies[name] ? 'set' : 'add'} ${name}@${spec}`);
}

packageJson.dependencies = sortObject(packageJson.dependencies);

if (write) {
  writeJsonFile(packageJsonPath, packageJson);
  writeJsonFile(manifestPath, nextManifest);
}

const requiredCount = Object.keys(nextAutoDependencies).length;
console.log(`${requiredCount} packaged runtime dependencies are required.`);
if (changes.length > 0) {
  console.log(changes.join('\n'));
  if (!write)
    console.log('Run with --write to update package.json and scripts/packaged-runtime-deps.json.');
} else {
  console.log('No package.json changes needed.');
}
