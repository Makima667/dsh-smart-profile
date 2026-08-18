function rec(id, title, priority, reason, searchTerms) { return { id, title, priority, reason, searchTerms } }

export function recommendProfile(scan) {
  const s = scan?.summary ?? {}
  const languages = new Set(s.languages ?? []), frameworks = new Set(s.frameworks ?? []), databases = new Set(s.databases ?? [])
  const infrastructure = new Set(s.infrastructure ?? []), cloud = new Set(s.cloud ?? []), ci = new Set(s.ci ?? []), testing = new Set(s.testing ?? [])
  const out = []
  const languageRules = [
    ['TypeScript', 'node-runtime', 'Node.js / TypeScript project tools', ['node', 'typescript']], ['JavaScript', 'node-runtime', 'Node.js project tools', ['node', 'javascript']],
    ['Python', 'python-runtime', 'Python project tools', ['python', 'pytest']], ['Go', 'go-runtime', 'Go project tools', ['go', 'golang']], ['Rust', 'rust-runtime', 'Rust project tools', ['rust', 'cargo']],
    ['Java/Kotlin', 'jvm-runtime', 'JVM project tools', ['java', 'kotlin']], ['PHP', 'php-runtime', 'PHP project tools', ['php', 'composer']], ['Ruby', 'ruby-runtime', 'Ruby project tools', ['ruby', 'bundler']],
    ['.NET', 'dotnet-runtime', '.NET project tools', ['dotnet', 'csharp']], ['Dart', 'dart-runtime', 'Dart / Flutter project tools', ['dart', 'flutter']],
  ]
  for (const [lang, id, title, terms] of languageRules) if (languages.has(lang)) out.push(rec(id, title, 'high', `Detected ${lang} project metadata.`, terms))
  if (['Next.js', 'React', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Flutter'].some((x) => frameworks.has(x))) out.push(rec('browser', 'Browser/UI automation', 'high', 'A user-interface framework was detected.', ['browser', 'playwright', 'ui testing']))
  if (['Express', 'Fastify', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Gin', 'Axum', 'Actix Web', 'Laravel', 'Symfony', 'Rails', 'Sinatra', 'ASP.NET Core'].some((x) => frameworks.has(x))) out.push(rec('api', 'API inspection and testing', 'high', 'A backend/API framework was detected.', ['api', 'http', 'openapi']))
  if (databases.size) out.push(rec('database', 'Database tooling', 'high', `Detected database signals: ${[...databases].join(', ')}.`, ['database', ...[...databases].map((x) => x.toLowerCase())]))
  if (infrastructure.has('Docker')) out.push(rec('containers', 'Container tooling', 'high', 'Docker/Compose configuration is present.', ['docker', 'containers']))
  if (infrastructure.has('Kubernetes') || infrastructure.has('Helm')) out.push(rec('kubernetes', 'Kubernetes tooling', 'high', 'Kubernetes/Helm configuration is present.', ['kubernetes', 'helm']))
  if (infrastructure.has('Terraform')) out.push(rec('terraform', 'Infrastructure-as-code tooling', 'high', 'Terraform configuration is present.', ['terraform', 'iac']))
  if (cloud.size) out.push(rec('cloud', 'Cloud platform tooling', 'medium', `Detected cloud signals: ${[...cloud].join(', ')}.`, ['cloud', ...[...cloud].map((x) => x.toLowerCase())]))
  if (ci.has('GitHub Actions')) out.push(rec('github', 'GitHub integration', 'high', 'GitHub Actions configuration is present.', ['github', 'pull request', 'actions']))
  if (testing.has('Playwright') || testing.has('Cypress')) out.push(rec('browser-tests', 'Browser test execution', 'high', 'Browser test tooling was detected.', ['playwright', 'cypress']))
  if (testing.size && !testing.has('Playwright') && !testing.has('Cypress')) out.push(rec('tests', 'Test runner support', 'medium', `Detected test tooling: ${[...testing].join(', ')}.`, ['tests', ...[...testing].map((x) => x.toLowerCase())]))
  out.push(rec('safe-plugin-install', 'Plugin verification / safe install', 'medium', 'Preview and verification should precede activation of third-party Harness bundles.', ['plugin verify', 'safe install']))
  const rank = { high: 0, medium: 1, low: 2 }
  return out.filter((item, i, all) => all.findIndex((x) => x.id === item.id) === i).sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id))
}

export function formatScan(scan) {
  const lines = [`Project: ${scan.root}`]
  for (const [key, list] of Object.entries(scan.summary)) lines.push(`${key}: ${list.length ? list.join(', ') : 'none detected'}`)
  lines.push(`manifests scanned: ${scan.metrics?.manifestsScanned ?? 'n/a'}`)
  return lines.join('\n')
}
export function formatRecommendations(scan, recommendations) { return [formatScan(scan), '', 'Recommended capabilities:', ...recommendations.map((item) => `- [${item.priority}] ${item.title}: ${item.reason}`)].join('\n') }
