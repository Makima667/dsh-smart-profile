const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'

function normalizePackage(item) {
  const pkg = item?.package ?? item ?? {}
  return {
    name: pkg.name ?? '', version: pkg.version ?? null, description: pkg.description ?? '',
    keywords: Array.isArray(pkg.keywords) ? pkg.keywords : [], links: pkg.links ?? {},
    publisher: pkg.publisher?.username ?? pkg.publisher?.name ?? null, date: pkg.date ?? null,
    npmScore: item?.score?.final ?? item?.searchScore ?? null,
  }
}
function harnessMarker(pkg) {
  const text = [pkg.name, pkg.description, ...(pkg.keywords ?? [])].join(' ').toLowerCase()
  return pkg.name.startsWith('dsh-') || text.includes('dsh-plugin') || text.includes('deepseek-harness') || text.includes('deepseek harness') || text.includes('cordis plugin')
}
function termMatch(pkg, terms) {
  const text = [pkg.name, pkg.description, ...(pkg.keywords ?? [])].join(' ').toLowerCase()
  const hits = terms.filter((term) => text.includes(String(term).toLowerCase()))
  return { hits, ratio: terms.length ? hits.length / terms.length : 0 }
}
export function discoverFromCatalog(recommendations, catalog, { limitPerCapability = 8 } = {}) {
  const packages = catalog.map(normalizePackage).filter((pkg) => pkg.name && harnessMarker(pkg))
  const merged = new Map()
  for (const capability of recommendations) {
    const terms = [capability.id, ...(capability.searchTerms ?? [])]
    const matches = packages.map((pkg) => ({ pkg, match: termMatch(pkg, terms) })).filter(({ match }) => match.hits.length).sort((a, b) => b.match.ratio - a.match.ratio || (b.pkg.npmScore ?? 0) - (a.pkg.npmScore ?? 0)).slice(0, limitPerCapability)
    for (const { pkg, match } of matches) {
      if (!merged.has(pkg.name)) merged.set(pkg.name, { ...pkg, matchedCapabilities: [], matchedTerms: [] })
      const record = merged.get(pkg.name)
      if (!record.matchedCapabilities.includes(capability.id)) record.matchedCapabilities.push(capability.id)
      for (const term of match.hits) if (!record.matchedTerms.includes(term)) record.matchedTerms.push(term)
    }
  }
  return [...merged.values()].sort((a, b) => b.matchedCapabilities.length - a.matchedCapabilities.length || (b.npmScore ?? 0) - (a.npmScore ?? 0) || a.name.localeCompare(b.name))
}
export async function searchNpm(query, { fetchImpl = globalThis.fetch, size = 12 } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for npm discovery.')
  const url = `${NPM_SEARCH}?text=${encodeURIComponent(query)}&size=${Math.max(1, Math.min(size, 50))}`
  const response = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': 'dsh-smart-profile' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`npm registry search failed: HTTP ${response.status}`)
  const body = await response.json()
  return (body.objects ?? []).map(normalizePackage)
}
export async function discoverCandidates(recommendations, { fetchImpl = globalThis.fetch, limitCapabilities = 6, limitPerCapability = 8 } = {}) {
  const selected = recommendations.filter((x) => x.id !== 'safe-plugin-install').slice(0, limitCapabilities)
  const merged = new Map(), errors = []
  for (const capability of selected) {
    const query = `deepseek harness ${(capability.searchTerms ?? []).slice(0, 2).join(' ')}`.trim()
    try {
      const results = await searchNpm(query, { fetchImpl, size: Math.max(limitPerCapability * 2, 10) })
      const ranked = results.filter(harnessMarker).map((pkg) => ({ pkg, match: termMatch(pkg, [capability.id, ...(capability.searchTerms ?? [])]) })).sort((a, b) => b.match.ratio - a.match.ratio || (b.pkg.npmScore ?? 0) - (a.pkg.npmScore ?? 0)).slice(0, limitPerCapability)
      for (const { pkg, match } of ranked) {
        if (!merged.has(pkg.name)) merged.set(pkg.name, { ...pkg, matchedCapabilities: [], matchedTerms: [], sources: ['npm'] })
        const record = merged.get(pkg.name)
        if (!record.matchedCapabilities.includes(capability.id)) record.matchedCapabilities.push(capability.id)
        for (const term of match.hits) if (!record.matchedTerms.includes(term)) record.matchedTerms.push(term)
      }
    } catch (error) { errors.push({ capability: capability.id, message: error.message }) }
  }
  return { source: 'npm-public-registry', queriedCapabilities: selected.map((x) => x.id), candidates: [...merged.values()].sort((a, b) => b.matchedCapabilities.length - a.matchedCapabilities.length || (b.npmScore ?? 0) - (a.npmScore ?? 0) || a.name.localeCompare(b.name)), errors, note: 'Discovery only. No package is installed or executed by this step.' }
}
