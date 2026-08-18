const RULES = [
  { id: 'browser', patterns: ['frontend', 'front-end', 'ui', 'browser', 'page', 'css', 'react', 'vue', 'next', 'svelte', 'angular', 'e2e'] },
  { id: 'browser-tests', patterns: ['playwright', 'cypress', 'e2e', 'browser test', 'ui test'] },
  { id: 'api', patterns: ['api', 'http', 'endpoint', 'backend', 'back-end', 'openapi', 'rest', 'graphql'] },
  { id: 'database', patterns: ['database', 'db', 'sql', 'postgres', 'mysql', 'mongo', 'redis', 'migration', 'schema', 'query'] },
  { id: 'containers', patterns: ['docker', 'container', 'compose'] },
  { id: 'kubernetes', patterns: ['kubernetes', 'k8s', 'helm', 'cluster'] },
  { id: 'terraform', patterns: ['terraform', 'iac', 'infrastructure as code'] },
  { id: 'cloud', patterns: ['aws', 'azure', 'gcp', 'google cloud', 'cloud'] },
  { id: 'github', patterns: ['github', 'pull request', ' pr ', 'actions', 'ci', 'workflow', 'issue'] },
  { id: 'tests', patterns: ['test', 'tests', 'testing', 'spec', 'failing test', 'coverage'] },
  { id: 'safe-plugin-install', patterns: ['plugin', 'install', 'setup', 'configure profile', 'profile setup'] },
]
const RUNTIME_IDS = new Set(['node-runtime', 'python-runtime', 'go-runtime', 'rust-runtime', 'jvm-runtime', 'php-runtime', 'ruby-runtime', 'dotnet-runtime', 'dart-runtime'])
const CODE_PATTERNS = ['fix', 'bug', 'implement', 'code', 'refactor', 'build', 'develop', 'debug', 'feature', 'change']
const normalizeTask = (task) => ` ${String(task ?? '').trim().toLowerCase()} `
export function inferTaskCapabilities(task) { const text = normalizeTask(task); if (!text.trim()) return []; return RULES.filter((rule) => rule.patterns.some((pattern) => text.includes(pattern))).map((rule) => rule.id) }
export function composeTaskProfile(scan, recommendations, task, { maxCapabilities = 6 } = {}) {
  if (!String(task ?? '').trim()) throw new Error('Task text is required.')
  const inferred = inferTaskCapabilities(task), byId = new Map((recommendations ?? []).map((item) => [item.id, item])), selected = [], reasons = new Map()
  for (const id of inferred) { const item = byId.get(id); if (item && !selected.some((x) => x.id === id)) { selected.push(item); reasons.set(id, 'matched current task intent and project evidence') } }
  const text = normalizeTask(task), codeTask = CODE_PATTERNS.some((pattern) => text.includes(pattern)) || selected.some((x) => ['browser', 'api', 'database', 'tests', 'browser-tests'].includes(x.id))
  if (codeTask) for (const item of recommendations ?? []) if (RUNTIME_IDS.has(item.id) && !selected.some((x) => x.id === item.id)) { selected.unshift(item); reasons.set(item.id, 'project runtime needed to execute or inspect code for this task') }
  if (!selected.length) for (const item of (recommendations ?? []).filter((x) => x.priority === 'high' && x.id !== 'safe-plugin-install').slice(0, 3)) { selected.push(item); reasons.set(item.id, 'fallback to high-priority project capability because task intent was ambiguous') }
  const deduped = selected.filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index).slice(0, Math.max(1, maxCapabilities)), selectedIds = new Set(deduped.map((x) => x.id))
  return { task: String(task).trim(), inferredCapabilities: inferred, selected: deduped.map((item) => ({ ...item, taskReason: reasons.get(item.id) ?? 'selected by task composition' })), excluded: (recommendations ?? []).filter((item) => !selectedIds.has(item.id)).map((item) => ({ id: item.id, title: item.title, reason: 'not required by the current task' })), limits: { maxCapabilities, selectedCount: deduped.length, totalProjectCapabilities: (recommendations ?? []).length }, note: 'Composition only narrows capabilities. It does not install or execute third-party plugins.' }
}
