export const CONFIDENCE = { high: 0.92, medium: 0.68, low: 0.4 }

export function add(map, name, evidence, confidence = 'high', source = 'manifest') {
  const score = CONFIDENCE[confidence] ?? CONFIDENCE.medium
  if (!map.has(name)) map.set(name, { name, confidence, confidenceScore: score, evidence: [], sources: [] })
  const record = map.get(name)
  if (!record.evidence.includes(evidence)) record.evidence.push(evidence)
  if (!record.sources.includes(source)) record.sources.push(source)
  if (score > record.confidenceScore) Object.assign(record, { confidence, confidenceScore: score })
}

function dependencyEntries(pkg) {
  const out = new Map()
  for (const [section, confidence] of [['dependencies', 'high'], ['peerDependencies', 'high'], ['optionalDependencies', 'medium'], ['devDependencies', 'medium']]) {
    for (const name of Object.keys(pkg?.[section] ?? {})) if (!out.has(name) || confidence === 'high') out.set(name, { section, confidence })
  }
  return out
}

function findDependency(deps, names) {
  for (const name of names) if (deps.has(name)) return { name, ...deps.get(name) }
  return null
}

export function detectPackageJson(pkg, rel, buckets) {
  if (!pkg || typeof pkg !== 'object') return
  const deps = dependencyEntries(pkg)
  const ts = findDependency(deps, ['typescript', 'tsx'])
  add(buckets.languages, ts ? 'TypeScript' : 'JavaScript', rel, ts?.confidence ?? 'high', 'package.json')

  const groups = [
    ['frameworks', [['Next.js', ['next']], ['React', ['react']], ['Vue', ['vue']], ['Nuxt', ['nuxt']], ['Svelte', ['@sveltejs/kit', 'svelte']], ['Angular', ['@angular/core']], ['Express', ['express']], ['Fastify', ['fastify']], ['NestJS', ['@nestjs/core']], ['Electron', ['electron']], ['Vite', ['vite']]]],
    ['testing', [['Playwright', ['@playwright/test', 'playwright']], ['Vitest', ['vitest']], ['Jest', ['jest']], ['Cypress', ['cypress']]]],
    ['databases', [['PostgreSQL', ['pg', 'postgres']], ['MySQL', ['mysql', 'mysql2']], ['MongoDB', ['mongodb', 'mongoose']], ['Redis', ['redis', 'ioredis']], ['SQLite', ['better-sqlite3', 'sqlite3']]]],
  ]
  for (const [bucket, rules] of groups) for (const [label, names] of rules) {
    const found = findDependency(deps, names)
    if (found) add(buckets[bucket], label, rel, found.confidence, `dependency:${found.section}`)
  }

  const tooling = [['Prisma', ['prisma', '@prisma/client']], ['Drizzle ORM', ['drizzle-orm']], ['Tailwind CSS', ['tailwindcss']]]
  for (const [label, names] of tooling) {
    const found = findDependency(deps, names)
    if (found) add(buckets.tooling, label, rel, found.confidence, `dependency:${found.section}`)
  }
  if (findDependency(deps, ['prisma', '@prisma/client'])) add(buckets.databases, 'SQL database (via Prisma)', rel, 'low', 'inference')
}

export function detectPython(text, rel, buckets) {
  if (!text) return
  add(buckets.languages, 'Python', rel)
  const lower = text.toLowerCase()
  for (const [label, bucket, needle] of [['FastAPI', 'frameworks', 'fastapi'], ['Django', 'frameworks', 'django'], ['Flask', 'frameworks', 'flask'], ['SQLAlchemy', 'tooling', 'sqlalchemy'], ['Celery', 'tooling', 'celery'], ['Pytest', 'testing', 'pytest']]) if (lower.includes(needle)) add(buckets[bucket], label, rel, 'high', 'python-manifest')
  if (/\b(redis|redis-py)\b/.test(lower)) add(buckets.databases, 'Redis', rel, 'medium')
  if (/\b(psycopg|asyncpg|postgresql|postgres)\b/.test(lower)) add(buckets.databases, 'PostgreSQL', rel, 'medium')
  if (/\b(pymongo|mongodb)\b/.test(lower)) add(buckets.databases, 'MongoDB', rel, 'medium')
}

export function detectManifest(name, text, rel, buckets) {
  const lower = text.toLowerCase()
  if (name === 'go.mod') {
    add(buckets.languages, 'Go', rel)
    if (text.includes('github.com/gin-gonic/gin')) add(buckets.frameworks, 'Gin', rel)
  } else if (name === 'Cargo.toml') {
    add(buckets.languages, 'Rust', rel)
    if (/\baxum\b/.test(text)) add(buckets.frameworks, 'Axum', rel)
    if (/\bactix-web\b/.test(text)) add(buckets.frameworks, 'Actix Web', rel)
  } else if (['pom.xml', 'build.gradle', 'build.gradle.kts'].includes(name)) {
    add(buckets.languages, 'Java/Kotlin', rel)
    if (/spring-boot|org\.springframework\.boot/i.test(text)) add(buckets.frameworks, 'Spring Boot', rel)
  } else if (name === 'composer.json') {
    add(buckets.languages, 'PHP', rel)
    if (lower.includes('laravel/framework')) add(buckets.frameworks, 'Laravel', rel)
    if (lower.includes('symfony/framework-bundle')) add(buckets.frameworks, 'Symfony', rel)
    if (lower.includes('phpunit/phpunit')) add(buckets.testing, 'PHPUnit', rel)
  } else if (name === 'Gemfile' || name.endsWith('.gemspec')) {
    add(buckets.languages, 'Ruby', rel)
    if (/\brails\b/.test(lower)) add(buckets.frameworks, 'Rails', rel)
    if (/\bsinatra\b/.test(lower)) add(buckets.frameworks, 'Sinatra', rel)
    if (/\brspec\b/.test(lower)) add(buckets.testing, 'RSpec', rel)
  } else if (/\.(cs|fs|vb)proj$/.test(name)) {
    add(buckets.languages, '.NET', rel)
    if (/microsoft\.aspnetcore|sdk="microsoft\.net\.sdk\.web/i.test(text)) add(buckets.frameworks, 'ASP.NET Core', rel)
    if (/xunit/i.test(text)) add(buckets.testing, 'xUnit', rel)
  } else if (name === 'pubspec.yaml') {
    add(buckets.languages, 'Dart', rel)
    if (/\bflutter\s*:/m.test(text) || /sdk:\s*flutter/m.test(text)) add(buckets.frameworks, 'Flutter', rel)
  } else if (name.endsWith('.tf') || name.endsWith('.tf.json')) add(buckets.infrastructure, 'Terraform', rel)
  else if (name === 'Chart.yaml') add(buckets.infrastructure, 'Helm', rel)
}
