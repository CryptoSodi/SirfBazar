'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const api = path.resolve(__dirname, '../apps/api');
const output = path.resolve(process.argv[2] || '');
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || '') || process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Linux x64 runner and exact Git commit required.');
if (!process.env.RUNNER_TEMP || !output.startsWith(path.resolve(process.env.RUNNER_TEMP) + path.sep) || fs.existsSync(output)) throw new Error('Release must use a new runner-temporary directory.');
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
fs.mkdirSync(output, { recursive: true });
for (const name of ['dist', 'src']) fs.cpSync(path.join(api, name), path.join(output, name), { recursive: true });
for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(api, name), path.join(output, name));
fs.mkdirSync(path.join(output, 'prisma'));
fs.copyFileSync(path.join(api, 'prisma/schema.prisma'), path.join(output, 'prisma/schema.prisma'));
fs.mkdirSync(path.join(output, 'scripts'));
for (const name of ['category-rollout.cjs', 'category-plan.cjs', 'category-sections.cjs']) fs.copyFileSync(path.join(api, 'scripts', name), path.join(output, 'scripts', name));
// Install production dependencies separately; pruning with the lock disabled caused earlier drift.
execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: output, stdio: 'inherit' });
fs.cpSync(path.join(api, 'node_modules/.prisma/client'), path.join(output, 'node_modules/.prisma/client'), { recursive: true });
const lock = JSON.parse(fs.readFileSync(path.join(output, 'package-lock.json'), 'utf8'));
const files = [];
let packages = 0;
function scan(directory) {
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name), stat = fs.lstatSync(filename), relative = path.relative(output, filename).replaceAll(path.sep, '/');
    if (stat.isDirectory()) scan(filename);
    else if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(filename);
      if (path.isAbsolute(target) || !path.resolve(path.dirname(filename), target).startsWith(output + path.sep)) throw new Error('Dependency symlink escapes release.');
      files.push({ path: relative, link: target });
    } else if (stat.isFile()) {
      files.push({ path: relative, bytes: stat.size, sha256: hash(filename) });
      if (name === 'package.json' && lock.packages[path.dirname(relative)]) {
        const actual = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (actual.version !== lock.packages[path.dirname(relative)].version) throw new Error(`Dependency differs from lock: ${relative}`);
        packages++;
      }
    } else throw new Error('Unexpected release file type.');
  }
}
scan(output);
const schema = fs.readFileSync(path.join(output, 'prisma/schema.prisma')).toString('utf8').replace(/\r\n/g, '\n');
const manifest = { repository: 'CryptoSodi/SirfBazar', sha, nodeMajor: 22, platform: 'linux', arch: 'x64', schemaSha256: crypto.createHash('sha256').update(schema).digest('hex'), files };
fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify(manifest) + '\n');
console.log(JSON.stringify({ sha, files: files.length, lockedProductionPackages: packages, containsRuntimeSecrets: false }));
