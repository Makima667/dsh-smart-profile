import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { add, detectManifest, detectPackageJson, detectPython } from './detect.js'

const FIXED = new Set(['package.json', 'pyproject.toml', 'requirements.txt', 'Pipfile', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile', 'pubspec.yaml', 'Chart.yaml'])
const EXTENSIONS = ['.csproj', '.fsproj', '.vbproj', '.gemspec', '.tf', '.tf.json']
const IGNORED = new Set(['.git', '.hg', '.svn', '.idea', '.vscode', 'node_modules', '.next', '.nuxt', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', 'target', 'vendor', '.turbo', '.cache', '.dart_tool', '.terraform'])
const MAX_MANIFESTS = 120
const MAX_DEPTH = 4

async function exists(file) { try { await access(file); return true } catch { return false } }
async function readText(file, maxBytes = 300_000) { try { const info = await stat(file); return info.isFile() && info.size <= maxBytes ? await readFile(file, 'utf8') : '' } catch { return '' } }
async function readJson(file) { const text = await readText(file); if (!text) return null; try { return JSON.parse(text) } catch { return null } }
const rel = (root, file) => (path.relative(root, file) || '.').split(path.sep).join('/')
const isManifest = (name) => FIXED.has(name) || EXTENSIONS.some((ext) => name.endsWith(ext))

async function collect(root) {
  const out = []
  async function walk(dir, depth) {
    if (depth > MAX_DEPTH || out.length >= MAX_MANIFESTS) return
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (out.length >= MAX_MANIFESTS) break
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { if (!IGNORED.has(entry.name) && depth < MAX_DEPTH) await walk(full, depth + 1) }
      else if (entry.isFile() && isManifest(entry.name)) out.push(full)
    }
  }
  await walk(root, 0)
  return out
}

async function rootSignals(root, b, evidence) {
  const signals = [
    ['Docker', ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'], 'infrastructure'],
    ['GitHub Actions', ['.github/workflows'], 'ci'], ['Git repository', ['.git'], 'tooling'],
    ['pnpm workspace', ['pnpm-workspace.yaml'], 'structure'], ['Turborepo', ['turbo.json'], 'structure'], ['Nx workspace', ['nx.json'], 'structure'], ['Lerna workspace', ['lerna.json'], 'structure'],
    ['Kubernetes', ['k8s', 'kubernetes'], 'infrastructure'], ['Helm', ['helm', 'charts'], 'infrastructure'],
    ['AWS', ['cdk.json', 'samconfig.toml'], 'cloud'], ['Azure', ['azure.yaml'], 'cloud'], ['Google Cloud', ['firebase.json'], 'cloud'],
    ['Azure Pipelines', ['azure-pipelines.yml', 'azure-pipelines.yaml'], 'ci'], ['Google Cloud Build', ['cloudbuild.yaml', 'cloudbuild.yml'], 'ci'],
  ]
  for (const [label, candidates, bucket] of signals) for (const candidate of candidates) if (await exists(path.join(root, candidate))) { add(b[bucket], label, candidate, 'high', 'root-signal'); evidence.push(candidate); break }

  for (const name of ['serverless.yml', 'serverless.yaml']) if (await exists(path.join(root, name))) {
    const text = (await readText(path.join(root, name))).toLowerCase()
    if (/provider:\s*(?:\n\s*)?(?:name:\s*)?aws\b/.test(text) || /name:\s*aws\b/.test(text)) add(b.cloud, 'AWS', name, 'medium', 'config-content')
    evidence.push(name)
  }
  for (const name of ['template.yaml', 'template.yml']) if (await exists(path.join(root, name))) {
    const text = await readText(path.join(root, name))
    if (/AWS::Serverless|Transform:\s*AWS::Serverless/i.test(text)) add(b.cloud, 'AWS', name, 'high', 'sam-template')
    evidence.push(name)
  }
  for (const [label, file] of [['pnpm', 'pnpm-lock.yaml'], ['npm', 'package-lock.json'], ['Yarn', 'yarn.lock'], ['Bun', 'bun.lockb'], ['Poetry', 'poetry.lock'], ['uv', 'uv.lock']]) if (await exists(path.join(root, file))) add(b.tooling, `${label} package manager`, file, 'high', 'lockfile')
  if (await exists(path.join(root, 'tsconfig.json'))) add(b.languages, 'TypeScript', 'tsconfig.json')
  if (await exists(path.join(root, 'Makefile'))) add(b.tooling, 'Make', 'Makefile')
  if (await exists(path.join(root, '.env.example'))) evidence.push('.env.example')
}

function values(map) { return [...map.values()].map((x) => ({ ...x, evidence: x.evidence.slice(0, 8), sources: x.sources.slice(0, 8) })).sort((a, b) => b.confidenceScore - a.confidenceScore || a.name.localeCompare(b.name)) }
const unique = (items) => [...new Set(items)]
function collapseLanguages(items) { return items.some((x) => x.name === 'TypeScript') ? items.filter((x) => x.name !== 'JavaScript') : items }

export async function scanProject(inputRoot = process.cwd()) {
  const root = path.resolve(inputRoot)
  const info = await stat(root).catch(() => null)
  if (!info?.isDirectory()) throw new Error(`Project path is not a directory: ${root}`)
  const b = Object.fromEntries(['languages', 'frameworks', 'databases', 'infrastructure', 'cloud', 'ci', 'testing', 'tooling', 'structure'].map((k) => [k, new Map()]))
  const evidence = []
  await rootSignals(root, b, evidence)
  const manifests = await collect(root)
  for (const file of manifests) {
    const name = path.basename(file), relative = rel(root, file)
    evidence.push(relative)
    if (name === 'package.json') detectPackageJson(await readJson(file), relative, b)
    else {
      const text = await readText(file)
      if (['pyproject.toml', 'requirements.txt', 'Pipfile'].includes(name)) detectPython(text, relative, b)
      else detectManifest(name, text, relative, b)
    }
  }
  const topPackage = await readJson(path.join(root, 'package.json'))
  if (Array.isArray(topPackage?.workspaces) || topPackage?.workspaces?.packages) add(b.structure, 'npm/yarn workspaces', 'package.json')
  const details = { languages: collapseLanguages(values(b.languages)), frameworks: values(b.frameworks), databases: values(b.databases), infrastructure: values(b.infrastructure), cloud: values(b.cloud), ci: values(b.ci), testing: values(b.testing), tooling: values(b.tooling), structure: values(b.structure) }
  const summary = Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'tooling').map(([k, v]) => [k, v.map((x) => x.name)]))
  return { schemaVersion: 2, root, summary, details, evidence: unique(evidence).slice(0, 160), metrics: { manifestsScanned: manifests.length, categoriesDetected: Object.values(summary).reduce((n, v) => n + v.length, 0) }, limits: { maxManifestDepth: MAX_DEPTH, maxManifests: MAX_MANIFESTS, secretFilesRead: false, note: 'Only known project manifests, lockfiles, and selected configuration filenames are inspected. .env files and arbitrary source files are not read.' } }
}
