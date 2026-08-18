import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const MANIFEST_NAMES = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'Pipfile',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'go.mod',
  'Cargo.toml',
])

const IGNORED_DIRS = new Set([
  '.git', '.hg', '.svn', '.idea', '.vscode',
  'node_modules', '.next', '.nuxt', 'dist', 'build', 'coverage',
  '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache',
  'target', 'vendor', '.turbo', '.cache',
])

const MAX_MANIFESTS = 80

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function readText(file, maxBytes = 256_000) {
  try {
    const info = await stat(file)
    if (!info.isFile() || info.size > maxBytes) return ''
    return await readFile(file, 'utf8')
  } catch {
    return ''
  }
}

async function readJson(file) {
  const text = await readText(file)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeRel(root, file) {
  const rel = path.relative(root, file) || '.'
  return rel.split(path.sep).join('/')
}

async function collectManifests(root, maxDepth = 3) {
  const results = []

  async function walk(dir, depth) {
    if (results.length >= MAX_MANIFESTS || depth > maxDepth) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= MAX_MANIFESTS) break
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && depth < maxDepth) {
          await walk(full, depth + 1)
        }
      } else if (entry.isFile() && MANIFEST_NAMES.has(entry.name)) {
        results.push(full)
      }
    }
  }

  await walk(root, 0)
  return results
}

function add(map, name, evidence, confidence = 'high') {
  if (!map.has(name)) map.set(name, { name, confidence, evidence: [] })
  const record = map.get(name)
  if (!record.evidence.includes(evidence)) record.evidence.push(evidence)
  if (confidence === 'high') record.confidence = 'high'
}

function packageDeps(pkg) {
  return {
    ...(pkg?.dependencies ?? {}),
    ...(pkg?.devDependencies ?? {}),
    ...(pkg?.peerDependencies ?? {}),
    ...(pkg?.optionalDependencies ?? {}),
  }
}

function hasAny(deps, names) {
  return names.some((name) => Object.prototype.hasOwnProperty.call(deps, name))
}

function detectFromPackageJson(pkg, rel, buckets) {
  if (!pkg || typeof pkg !== 'object') return
  const deps = packageDeps(pkg)
  add(buckets.languages, hasAny(deps, ['typescript', 'tsx']) ? 'TypeScript' : 'JavaScript', rel)

  const frameworkRules = [
    ['Next.js', ['next']],
    ['React', ['react']],
    ['Vue', ['vue']],
    ['Nuxt', ['nuxt']],
    ['Svelte', ['svelte', '@sveltejs/kit']],
    ['Angular', ['@angular/core']],
    ['Express', ['express']],
    ['Fastify', ['fastify']],
    ['NestJS', ['@nestjs/core']],
    ['Electron', ['electron']],
    ['Vite', ['vite']],
  ]
  for (const [name, names] of frameworkRules) {
    if (hasAny(deps, names)) add(buckets.frameworks, name, rel)
  }

  const testingRules = [
    ['Playwright', ['@playwright/test', 'playwright']],
    ['Vitest', ['vitest']],
    ['Jest', ['jest']],
    ['Cypress', ['cypress']],
  ]
  for (const [name, names] of testingRules) {
    if (hasAny(deps, names)) add(buckets.testing, name, rel)
  }

  const dbRules = [
    ['PostgreSQL', ['pg', 'postgres', '@prisma/client']],
    ['MySQL', ['mysql', 'mysql2']],
    ['MongoDB', ['mongodb', 'mongoose']],
    ['Redis', ['redis', 'ioredis']],
    ['SQLite', ['better-sqlite3', 'sqlite3']],
  ]
  for (const [name, names] of dbRules) {
    if (hasAny(deps, names)) add(buckets.databases, name, rel, name === 'PostgreSQL' && hasAny(deps, ['@prisma/client']) ? 'medium' : 'high')
  }

  if (hasAny(deps, ['prisma', '@prisma/client'])) add(buckets.tooling, 'Prisma', rel)
  if (hasAny(deps, ['drizzle-orm'])) add(buckets.tooling, 'Drizzle ORM', rel)
  if (hasAny(deps, ['tailwindcss'])) add(buckets.tooling, 'Tailwind CSS', rel)
  if (hasAny(deps, ['typescript'])) add(buckets.tooling, 'TypeScript compiler', rel)
}

function detectPythonText(text, rel, buckets) {
  if (!text) return
  add(buckets.languages, 'Python', rel)
  const lower = text.toLowerCase()
  const rules = [
    ['FastAPI', ['fastapi']],
    ['Django', ['django']],
    ['Flask', ['flask']],
    ['SQLAlchemy', ['sqlalchemy']],
    ['Celery', ['celery']],
    ['Pytest', ['pytest']],
  ]
  for (const [name, needles] of rules) {
    if (needles.some((needle) => lower.includes(needle))) {
      if (name === 'Pytest') add(buckets.testing, name, rel)
      else if (name === 'SQLAlchemy' || name === 'Celery') add(buckets.tooling, name, rel)
      else add(buckets.frameworks, name, rel)
    }
  }
  if (lower.includes('redis')) add(buckets.databases, 'Redis', rel, 'medium')
  if (lower.includes('psycopg') || lower.includes('asyncpg') || lower.includes('postgres')) add(buckets.databases, 'PostgreSQL', rel, 'medium')
  if (lower.includes('pymongo') || lower.includes('mongodb')) add(buckets.databases, 'MongoDB', rel, 'medium')
}

function detectGenericManifest(name, text, rel, buckets) {
  switch (name) {
    case 'go.mod':
      add(buckets.languages, 'Go', rel)
      if (text.includes('github.com/gin-gonic/gin')) add(buckets.frameworks, 'Gin', rel)
      break
    case 'Cargo.toml':
      add(buckets.languages, 'Rust', rel)
      if (/\baxum\b/.test(text)) add(buckets.frameworks, 'Axum', rel)
      if (/\bactix-web\b/.test(text)) add(buckets.frameworks, 'Actix Web', rel)
      break
    case 'pom.xml':
    case 'build.gradle':
    case 'build.gradle.kts':
      add(buckets.languages, 'Java/Kotlin', rel)
      if (text.includes('spring-boot') || text.includes('org.springframework.boot')) add(buckets.frameworks, 'Spring Boot', rel)
      break
    default:
      break
  }
}

async function detectRootSignals(root, buckets, evidence) {
  const signals = [
    ['Docker', ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'], buckets.infrastructure],
    ['GitHub Actions', ['.github/workflows'], buckets.ci],
    ['Git repository', ['.git'], buckets.tooling],
    ['pnpm workspace', ['pnpm-workspace.yaml'], buckets.structure],
    ['Turborepo', ['turbo.json'], buckets.structure],
    ['Nx workspace', ['nx.json'], buckets.structure],
    ['Lerna workspace', ['lerna.json'], buckets.structure],
  ]

  for (const [label, candidates, bucket] of signals) {
    for (const candidate of candidates) {
      const full = path.join(root, candidate)
      if (await exists(full)) {
        add(bucket, label, candidate)
        evidence.push(candidate)
        break
      }
    }
  }

  if (await exists(path.join(root, 'tsconfig.json'))) add(buckets.languages, 'TypeScript', 'tsconfig.json')
  if (await exists(path.join(root, 'Makefile'))) add(buckets.tooling, 'Make', 'Makefile')
  if (await exists(path.join(root, '.env.example'))) evidence.push('.env.example')
}

function values(map) {
  return [...map.values()].map((item) => ({
    ...item,
    evidence: item.evidence.slice(0, 6),
  }))
}

function unique(items) {
  return [...new Set(items)]
}

export async function scanProject(inputRoot = process.cwd()) {
  const root = path.resolve(inputRoot)
  const info = await stat(root).catch(() => null)
  if (!info?.isDirectory()) throw new Error(`Project path is not a directory: ${root}`)

  const buckets = {
    languages: new Map(),
    frameworks: new Map(),
    databases: new Map(),
    infrastructure: new Map(),
    ci: new Map(),
    testing: new Map(),
    tooling: new Map(),
    structure: new Map(),
  }
  const evidence = []

  await detectRootSignals(root, buckets, evidence)
  const manifests = await collectManifests(root)

  for (const file of manifests) {
    const rel = normalizeRel(root, file)
    const base = path.basename(file)
    evidence.push(rel)
    if (base === 'package.json') {
      detectFromPackageJson(await readJson(file), rel, buckets)
    } else {
      const text = await readText(file)
      if (base === 'pyproject.toml' || base === 'requirements.txt' || base === 'Pipfile') {
        detectPythonText(text, rel, buckets)
      } else {
        detectGenericManifest(base, text, rel, buckets)
      }
    }
  }

  const topPackage = await readJson(path.join(root, 'package.json'))
  if (Array.isArray(topPackage?.workspaces) || topPackage?.workspaces?.packages) {
    add(buckets.structure, 'npm/yarn workspaces', 'package.json')
  }

  const result = {
    schemaVersion: 1,
    root,
    summary: {
      languages: values(buckets.languages).map((x) => x.name),
      frameworks: values(buckets.frameworks).map((x) => x.name),
      databases: values(buckets.databases).map((x) => x.name),
      infrastructure: values(buckets.infrastructure).map((x) => x.name),
      ci: values(buckets.ci).map((x) => x.name),
      testing: values(buckets.testing).map((x) => x.name),
      structure: values(buckets.structure).map((x) => x.name),
    },
    details: {
      languages: values(buckets.languages),
      frameworks: values(buckets.frameworks),
      databases: values(buckets.databases),
      infrastructure: values(buckets.infrastructure),
      ci: values(buckets.ci),
      testing: values(buckets.testing),
      tooling: values(buckets.tooling),
      structure: values(buckets.structure),
    },
    evidence: unique(evidence).slice(0, 100),
    limits: {
      maxManifestDepth: 3,
      maxManifests: MAX_MANIFESTS,
      secretFilesRead: false,
      note: 'Only known project manifests and filenames are inspected. .env files and arbitrary source files are not read.',
    },
  }

  return result
}

function rec(id, title, priority, reason, searchTerms) {
  return { id, title, priority, reason, searchTerms }
}

export function recommendProfile(scan) {
  const s = scan?.summary ?? {}
  const languages = new Set(s.languages ?? [])
  const frameworks = new Set(s.frameworks ?? [])
  const databases = new Set(s.databases ?? [])
  const infrastructure = new Set(s.infrastructure ?? [])
  const ci = new Set(s.ci ?? [])
  const testing = new Set(s.testing ?? [])
  const recommendations = []

  if (languages.has('JavaScript') || languages.has('TypeScript')) {
    recommendations.push(rec('node-runtime', 'Node.js project tools', 'high', 'The workspace contains a Node.js/TypeScript project.', ['node', 'typescript', 'package manager']))
  }
  if (languages.has('Python')) {
    recommendations.push(rec('python-runtime', 'Python project tools', 'high', 'The workspace contains Python manifests.', ['python', 'pytest', 'virtualenv']))
  }
  if (languages.has('Go')) recommendations.push(rec('go-runtime', 'Go project tools', 'medium', 'The workspace contains go.mod.', ['go', 'golang']))
  if (languages.has('Rust')) recommendations.push(rec('rust-runtime', 'Rust project tools', 'medium', 'The workspace contains Cargo.toml.', ['rust', 'cargo']))
  if (languages.has('Java/Kotlin')) recommendations.push(rec('jvm-runtime', 'JVM project tools', 'medium', 'The workspace contains Maven or Gradle manifests.', ['java', 'kotlin', 'maven', 'gradle']))

  const webFrameworks = ['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular']
  if (webFrameworks.some((name) => frameworks.has(name))) {
    recommendations.push(rec('browser', 'Browser automation', 'high', 'A browser-facing frontend framework was detected.', ['browser', 'playwright', 'web testing']))
  }

  const apiFrameworks = ['Express', 'Fastify', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Gin', 'Axum', 'Actix Web']
  if (apiFrameworks.some((name) => frameworks.has(name))) {
    recommendations.push(rec('api', 'API inspection and testing', 'high', 'A backend/API framework was detected.', ['api', 'http', 'openapi']))
  }

  if (databases.size > 0) {
    recommendations.push(rec('database', 'Database tooling', 'high', `Detected database signals: ${[...databases].join(', ')}.`, ['database', ...[...databases].map((x) => x.toLowerCase())]))
  }
  if (infrastructure.has('Docker')) {
    recommendations.push(rec('containers', 'Container tooling', 'high', 'Docker/Compose configuration is present.', ['docker', 'containers', 'compose']))
  }
  if (ci.has('GitHub Actions')) {
    recommendations.push(rec('github', 'GitHub integration', 'high', 'GitHub Actions configuration is present, so repository/CI tools are likely useful.', ['github', 'pull request', 'actions']))
  }
  if (testing.has('Playwright') || testing.has('Cypress')) {
    recommendations.push(rec('browser-tests', 'Browser test execution', 'high', `Detected ${[...testing].filter((x) => x === 'Playwright' || x === 'Cypress').join(', ')}.`, ['playwright', 'cypress', 'browser testing']))
  }
  if ((testing.size > 0) && !testing.has('Playwright') && !testing.has('Cypress')) {
    recommendations.push(rec('tests', 'Test runner support', 'medium', `Detected test tooling: ${[...testing].join(', ')}.`, ['tests', ...[...testing].map((x) => x.toLowerCase())]))
  }

  recommendations.push(rec('safe-plugin-install', 'Plugin verification / safe install', 'medium', 'DeepSeek Harness is in developer preview and third-party bundles execute with host privileges; preview and verification are useful before activation.', ['plugin gate', 'plugin verify', 'safe install']))

  const rank = { high: 0, medium: 1, low: 2 }
  return recommendations
    .filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index)
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id))
}

export function formatScan(scan) {
  const lines = []
  lines.push(`Project: ${scan.root}`)
  for (const [key, values] of Object.entries(scan.summary)) {
    lines.push(`${key}: ${values.length ? values.join(', ') : 'none detected'}`)
  }
  return lines.join('\n')
}

export function formatRecommendations(scan, recommendations) {
  const lines = [formatScan(scan), '', 'Recommended capabilities:']
  for (const item of recommendations) {
    lines.push(`- [${item.priority}] ${item.title}: ${item.reason}`)
  }
  return lines.join('\n')
}
