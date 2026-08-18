import path from 'node:path'
import { scanProject, recommendProfile } from './core.js'
import { composeTaskProfile } from './compose.js'
import { discoverCandidates } from './discovery.js'
import { scoreCandidates } from './scoring.js'
import { compatibilityReport, normalizeDshTarget } from './compat.js'
import { buildInstallPlan, defaultRunner, safeInstall } from './install.js'

function dshSpecFor(target) {
  const normalized = normalizeDshTarget(target)
  return `@deepseek-ai/dsh@${normalized.label}`
}
function eligible(candidate, minScore) {
  if ((candidate.score ?? 0) < minScore) return false
  if (candidate.recommendation === 'review-required') return false
  if ((candidate.riskFlags ?? []).some((flag) => flag.startsWith('lifecycle-scripts'))) return false
  if (!candidate.metadata?.dsh?.bundle?.patch) return false
  return true
}
export function selectCandidates(recommendations, scoredCandidates, { minScore = 70 } = {}) {
  const selectedByName = new Map(), unresolved = []
  const safeCandidates = (scoredCandidates ?? []).filter((candidate) => eligible(candidate, minScore))
  for (const capability of recommendations ?? []) {
    if (capability.id === 'safe-plugin-install') continue
    const match = safeCandidates.find((candidate) => (candidate.matchedCapabilities ?? []).includes(capability.id))
    if (!match) { unresolved.push({ capability: capability.id, title: capability.title, reason: `No eligible candidate scored >= ${minScore} with a declared DSH bundle and no blocking lifecycle-script risk.` }); continue }
    if (!selectedByName.has(match.name)) selectedByName.set(match.name, { candidate: match, covers: [] })
    selectedByName.get(match.name).covers.push(capability.id)
  }
  return { selected: [...selectedByName.values()], unresolved }
}
export async function buildSetupPlan(root = process.cwd(), { task = '', profile = 'web', dshTarget = 'next', minScore = 70, fetchImpl = globalThis.fetch, discoverFn = discoverCandidates, scoreFn = scoreCandidates } = {}) {
  const resolvedRoot = path.resolve(root)
  const scan = await scanProject(resolvedRoot)
  const recommendations = recommendProfile(scan)
  const composition = task.trim() ? composeTaskProfile(scan, recommendations, task) : null
  const targetRecommendations = composition ? composition.selected : recommendations.filter((item) => item.id !== 'safe-plugin-install')
  const discovery = await discoverFn(targetRecommendations, { fetchImpl })
  const scoring = await scoreFn(discovery, { fetchImpl })
  const compatibility = await compatibilityReport(dshTarget)
  const selection = selectCandidates(targetRecommendations, scoring.candidates, { minScore })
  const dshSpec = dshSpecFor(dshTarget)
  const installs = selection.selected.map(({ candidate, covers }) => ({ candidate, covers, plan: buildInstallPlan(candidate, { profile, dshSpec }) }))
  return { schemaVersion: 1, root: resolvedRoot, profile, dshTarget, dshSpec, task: task.trim() || null, scan, recommendations, composition, discovery: { source: discovery.source, queriedCapabilities: discovery.queriedCapabilities, errors: discovery.errors ?? [] }, scoringSummary: { inspected: scoring.inspected ?? scoring.candidates?.length ?? 0, minimumScore: minScore }, compatibility: compatibility.result, installs, unresolved: selection.unresolved, writeGate: { requiresApplyFlag: true, requiresApprovalFlag: true, runtimeVerificationRequired: true, rollbackOnFailure: true }, note: 'This is a preview. No third-party package is installed until the caller explicitly requests apply and approval.' }
}
async function rollbackInstalled(installed, { profile, dshSpec, runner }) {
  const results = []
  for (const candidate of [...installed].reverse()) {
    const command = buildInstallPlan(candidate, { profile, dshSpec }).commands.rollback
    try { const result = await runner(...command); results.push({ candidate: candidate.name, code: result.code, stderr: result.stderr ?? '' }) }
    catch (error) { results.push({ candidate: candidate.name, code: 1, stderr: error.message }) }
  }
  return results
}
export async function applySetupPlan(plan, { approved = false, runner = defaultRunner } = {}) {
  if (!approved) return { status: 'approval-required', plan, message: 'Preview the setup plan, then re-run with both apply intent and explicit approval.' }
  if (!plan?.installs?.length) return { status: 'nothing-to-install', plan, installed: [], unresolved: plan?.unresolved ?? [] }
  const installedThisRun = [], results = []
  for (const item of plan.installs) {
    const result = await safeInstall(item.candidate, { profile: plan.profile, dshSpec: plan.dshSpec, approved: true, runner })
    results.push({ candidate: item.candidate.name, covers: item.covers, result })
    if (result.status === 'installed') installedThisRun.push(item.candidate)
    if (result.status === 'already-present') continue
    if (result.status !== 'installed') {
      const rollback = await rollbackInstalled(installedThisRun, { profile: plan.profile, dshSpec: plan.dshSpec, runner })
      return { status: 'failed-rolled-back', failedCandidate: item.candidate.name, results, rollback, unresolved: plan.unresolved ?? [] }
    }
  }
  return { status: 'configured', results, installed: installedThisRun.map((candidate) => candidate.name), unresolved: plan.unresolved ?? [], compatibility: plan.compatibility }
}
