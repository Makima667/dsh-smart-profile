import { recommendProfile, scanProject } from './lib/core.js'
import { discoverCandidates } from './lib/discovery.js'

export const name = 'dsh-smart-profile'
export const inject = ['tools']
const modelText = (value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]
const sessionCwd = (exec) => exec?.agent?.session?.header?.cwd ?? process.cwd()
function toolDefinition(name, description, execute) { return { name, description, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, output: { schema: { type: 'json' }, render: (_args, value) => modelText(value) }, execute } }
export function apply(ctx) {
  ctx.tools.register(toolDefinition('smart_profile_scan', 'Inspect the current session workspace and identify its stack without reading secret files.', async (_args, exec) => scanProject(sessionCwd(exec))))
  ctx.tools.register(toolDefinition('smart_profile_recommend', 'Return a minimal, explainable set of capability categories useful for the current project.', async (_args, exec) => { const scan = await scanProject(sessionCwd(exec)); return { scan, recommendations: recommendProfile(scan) } }))
  ctx.tools.register(toolDefinition('smart_profile_discover', 'Search the public npm registry for DeepSeek Harness plugin candidates matching the current project capabilities. Discovery only: nothing is installed or executed.', async (_args, exec) => { const scan = await scanProject(sessionCwd(exec)); const recommendations = recommendProfile(scan); return { scan, recommendations, discovery: await discoverCandidates(recommendations) } }))
}
