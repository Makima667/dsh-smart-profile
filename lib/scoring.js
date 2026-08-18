const REGISTRY = 'https://registry.npmjs.org'
function repoUrl(repository) { if (!repository) return null; if (typeof repository === 'string') return repository; return repository.url ?? null }
export async function inspectNpmPackage(name, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for npm package inspection.')
  const response = await fetchImpl(`${REGISTRY}/${encodeURIComponent(name)}/latest`, { headers: { accept: 'application/json', 'user-agent': 'dsh-smart-profile' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`npm metadata request failed for ${name}: HTTP ${response.status}`)
  const body = await response.json()
  return { name: body.name ?? name, version: body.version ?? null, license: body.license ?? null, repository: repoUrl(body.repository), homepage: body.homepage ?? null, dependencies: Object.keys(body.dependencies ?? {}), optionalDependencies: Object.keys(body.optionalDependencies ?? {}), peerDependencies: body.peerDependencies ?? {}, scripts: body.scripts ?? {}, engines: body.engines ?? {}, dsh: body.dsh ?? null }
}
function ageScore(date, now) {
  if (!date) return { score: 6, note: 'release date unavailable' }
  const ageDays = Math.max(0, (now - new Date(date).getTime()) / 86_400_000)
  if (ageDays <= 90) return { score: 15, note: `released ${Math.round(ageDays)}d ago` }
  if (ageDays <= 365) return { score: 11, note: `released ${Math.round(ageDays)}d ago` }
  if (ageDays <= 730) return { score: 6, note: `released ${Math.round(ageDays)}d ago` }
  return { score: 2, note: `released ${Math.round(ageDays)}d ago` }
}
export function scoreCandidate(candidate, metadata = null, { now = Date.now() } = {}) {
  const riskFlags = [], matchedCapabilities = candidate.matchedCapabilities ?? [], matchedTerms = candidate.matchedTerms ?? []
  const projectFit = Math.min(35, 16 + matchedCapabilities.length * 7 + Math.min(8, matchedTerms.length * 2))
  const maintenance = ageScore(candidate.date, now)
  const popularity = Math.round(Math.max(0, Math.min(1, candidate.npmScore ?? 0)) * 8)
  let packageHealth = 0, supplyChain = 20, compatibility = 0
  if (metadata) {
    if (metadata.repository) packageHealth += 5
    if (metadata.license) packageHealth += 4
    if (metadata.homepage) packageHealth += 2
    if (metadata.dsh?.bundle?.patch) compatibility += 10
    else riskFlags.push('dsh-bundle-not-declared')
    const peerNames = Object.keys(metadata.peerDependencies ?? {})
    if (peerNames.some((x) => x.includes('deepseek') || x.includes('/dsh'))) compatibility += 3
    const lifecycle = ['preinstall', 'install', 'postinstall'].filter((name) => metadata.scripts?.[name])
    if (lifecycle.length) { supplyChain -= 12; riskFlags.push(`lifecycle-scripts:${lifecycle.join(',')}`) }
    const depCount = (metadata.dependencies?.length ?? 0) + (metadata.optionalDependencies?.length ?? 0)
    if (depCount > 60) { supplyChain -= 7; riskFlags.push('large-dependency-tree') }
    else if (depCount > 25) { supplyChain -= 3; riskFlags.push('medium-dependency-tree') }
    if (!metadata.repository) riskFlags.push('repository-missing')
    if (!metadata.license) riskFlags.push('license-missing')
  } else { packageHealth = 2; supplyChain = 8; riskFlags.push('metadata-unavailable') }
  supplyChain = Math.max(0, supplyChain)
  const total = Math.max(0, Math.min(100, projectFit + maintenance.score + popularity + packageHealth + supplyChain + compatibility))
  const grade = total >= 85 ? 'A' : total >= 75 ? 'B' : total >= 60 ? 'C' : total >= 45 ? 'D' : 'E'
  return { ...candidate, metadata, score: total, grade, breakdown: { projectFit, maintenance: maintenance.score, popularity, packageHealth, supplyChain, compatibility }, maintenanceNote: maintenance.note, riskFlags, recommendation: riskFlags.some((x) => x.startsWith('lifecycle-scripts')) ? 'review-required' : total >= 75 ? 'preferred' : total >= 55 ? 'consider' : 'low-confidence' }
}
export async function scoreCandidates(discovery, { fetchImpl = globalThis.fetch, maxInspect = 20, now = Date.now() } = {}) {
  const candidates = (discovery?.candidates ?? []).slice(0, maxInspect), scored = []
  for (const candidate of candidates) {
    let metadata = null, metadataError = null
    try { metadata = await inspectNpmPackage(candidate.name, { fetchImpl }) } catch (error) { metadataError = error.message }
    const result = scoreCandidate(candidate, metadata, { now })
    if (metadataError) result.metadataError = metadataError
    scored.push(result)
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return { candidates: scored, inspected: scored.length, note: 'Scores are advisory. Lifecycle scripts and missing metadata require human review before installation.' }
}
