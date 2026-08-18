import { recommendProfile, scanProject } from './lib/core.js'
import { discoverCandidates } from './lib/discovery.js'
import { scoreCandidates } from './lib/scoring.js'
import { buildInstallPlan } from './lib/install.js'
export const name = 'dsh-smart-profile'
export const inject = ['tools']
const modelText = (value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const sessionCwd = (exec) => exec?.agent?.session?.header?.cwd ?? process.cwd()
function toolDefinition(name, description, execute) { return { name, description, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, output: { schema: { type: 'json' }, render: (_args, value) => modelText(value) }, execute } }
async function context(exec) { const scan = await scanProject(sessionCwd(exec)); const recommendations = recommendProfile(scan); return { scan, recommendations } }
export function apply(ctx) {
  ctx.tools.register(toolDefinition('smart_profile_scan', 'Inspect the current session workspace and identify its stack without reading secret files.', async (_args, exec) => scanProject(sessionCwd(exec))))
  ctx.tools.register(toolDefinition('smart_profile_recommend', 'Return a minimal, explainable set of capability categories useful for the current project.', async (_args, exec) => context(exec)))
  ctx.tools.register(toolDefinition('smart_profile_discover', 'Search public npm for Harness plugin candidates. Discovery only; nothing is installed.', async (_args, exec) => { const base = await context(exec); return { ...base, discovery: await discoverCandidates(base.recommendations) } }))
  ctx.tools.register(toolDefinition('smart_profile_install_plan', 'Build a non-executing install/verify/rollback command plan for the highest-scoring candidate. This tool never runs the commands.', async (_args, exec) => { const base = await context(exec); const discovery = await discoverCandidates(base.recommendations); const scoring = await scoreCandidates(discovery); const candidate = scoring.candidates[0] ?? null; return { ...base, candidate, plan: candidate ? buildInstallPlan(candidate) : null } }))
  ctx.tools.register(toolDefinition('smart_profile_score', 'Discover and score candidate plugins using project fit, maintenance, package metadata, supply-chain signals, and DSH bundle declarations.', async (_args, exec) => { const base = await context(exec); const discovery = await discoverCandidates(base.recommendations); return { ...base, discovery, scoring: await scoreCandidates(discovery) } }))
}
