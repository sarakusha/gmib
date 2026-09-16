const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const SOURCE_MAP_DIRECTIVE = /[#@]\s*sourceMappingURL\s*=/i;
const PROJECT_SOURCE = /(^|\/)(packages\/[^/]+\/src|src)(\/|$)/;
const PROJECT_TEST = /(^|\/)(packages\/[^/]+\/test|test|tests|__tests__)(\/|$)/;
const SERVICE_FILE = /(^|\/)(?:\.env(?:\..*)?|AGENTS\.md|vite\.config\.[cm]?[jt]s)$/i;
const CODE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

const normalize = value => value.split(path.sep).join('/');

const findAsarBin = root => {
  const pnpm = path.join(root, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpm)) return undefined;
  const packageDirectory = fs.readdirSync(pnpm).find(name => name.startsWith('@electron+asar@'));
  if (!packageDirectory) return undefined;
  const candidate = path.join(
    pnpm,
    packageDirectory,
    'node_modules',
    '@electron',
    'asar',
    'bin',
    'asar.js',
  );
  return fs.existsSync(candidate) ? candidate : undefined;
};

const javascriptCommentRanges = text => {
  const comments = [];
  const source = ts.createSourceFile(
    'artifact.js',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const ranges = new Set();
  const addRanges = values => {
    for (const value of values ?? []) {
      const key = `${value.pos}:${value.end}`;
      if (!ranges.has(key)) {
        ranges.add(key);
        comments.push({ pos: value.pos, end: value.end });
      }
    }
  };
  const visit = node => {
    addRanges(ts.getLeadingCommentRanges(text, node.pos));
    addRanges(ts.getTrailingCommentRanges(text, node.end));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return comments;
};

const cssCommentRanges = text => {
  const comments = [];
  let quote;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      comments.push({ pos: index, end: end === -1 ? text.length : end + 2 });
      index = end === -1 ? text.length : end + 1;
    }
  }
  return comments;
};

const sourceMapCommentRanges = (text, extension) => {
  const ranges = extension === '.css' ? cssCommentRanges(text) : javascriptCommentRanges(text);
  return ranges.filter(range => SOURCE_MAP_DIRECTIVE.test(text.slice(range.pos, range.end)));
};

const walk = (root, visitor, relativeRoot = root) => {
  if (!fs.existsSync(root)) return;
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) return;
  if (!stat.isDirectory()) {
    visitor(root, normalize(path.relative(relativeRoot, root)));
    return;
  }
  for (const entry of fs.readdirSync(root)) walk(path.join(root, entry), visitor, relativeRoot);
};

const scanTree = (root, label, failures, totals) => {
  walk(root, (filename, relative) => {
    totals.files += 1;
    const displayed = `${label}/${relative}`;
    const extension = path.extname(filename).toLowerCase();
    const outsideDependencies = !/(^|\/)(?:node_modules|\.yalc)\//.test(relative);
    if (outsideDependencies && extension === '.map') {
      failures.push(`${displayed}: external source map`);
      return;
    }
    const isCodeTest = PROJECT_TEST.test(relative) && CODE_EXTENSIONS.has(extension);
    if (
      outsideDependencies &&
      (PROJECT_SOURCE.test(relative) || isCodeTest || SERVICE_FILE.test(relative))
    ) {
      failures.push(`${displayed}: project source, test, or service file`);
    }
    if (!outsideDependencies || (!CODE_EXTENSIONS.has(extension) && extension !== '.css')) return;
    const text = fs.readFileSync(filename, 'utf8');
    if (sourceMapCommentRanges(text, extension).length > 0) {
      failures.push(`${displayed}: active sourceMappingURL directive`);
    }
  });
};

const extractAndScanAsar = (archive, label, root, failures, totals) => {
  const asarBin = findAsarBin(root);
  if (!asarBin) throw new Error('Cannot locate @electron/asar for package verification');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gmib-asar-'));
  try {
    childProcess.execFileSync(process.execPath, [asarBin, 'extract', archive, temporary], {
      stdio: 'pipe',
    });
    totals.asars += 1;
    scanTree(temporary, `${label}:app.asar`, failures, totals);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

const verifyProductionArtifacts = (targets, projectRoot = path.resolve(__dirname, '..')) => {
  const failures = [];
  const totals = { files: 0, asars: 0 };
  for (const target of targets) {
    const absolute = path.resolve(target);
    if (!fs.existsSync(absolute)) throw new Error(`Artifact path does not exist: ${absolute}`);
    const stat = fs.statSync(absolute);
    if (stat.isFile() && path.basename(absolute) === 'app.asar') {
      extractAndScanAsar(
        absolute,
        normalize(path.relative(projectRoot, absolute)),
        projectRoot,
        failures,
        totals,
      );
      continue;
    }
    scanTree(absolute, normalize(path.relative(projectRoot, absolute)) || '.', failures, totals);
    walk(absolute, filename => {
      if (path.basename(filename) === 'app.asar') {
        extractAndScanAsar(
          filename,
          normalize(path.relative(projectRoot, path.dirname(filename))),
          projectRoot,
          failures,
          totals,
        );
      }
    });
  }
  if (failures.length > 0) {
    throw new Error(`Production artifact verification failed:\n${failures.join('\n')}`);
  }
  console.log(
    `Production artifact verification passed: ${totals.files} files, ${totals.asars} asar archives`,
  );
};

module.exports = { verifyProductionArtifacts };

if (require.main === module) {
  const defaults = ['packages/main/dist', 'packages/preload/dist', 'packages/renderer/dist'];
  verifyProductionArtifacts(process.argv.length > 2 ? process.argv.slice(2) : defaults);
}
