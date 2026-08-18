import { recommendProfile, scanProject } from './lib/core.js'

export const name = 'dsh-smart-profile'
export const inject = ['tools']

function modelText(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function sessionCwd(exec) {
  return exec?.agent?.session?.header?.cwd ?? process.cwd()
}

function toolDefinition(name, description, execute) {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => modelText(value),
    },
    execute,
  }
}

export function apply(ctx) {
  ctx.tools.register(toolDefinition(
    'smart_profile_scan',
    'Inspect the current session workspace and identify its languages, frameworks, infrastructure, databases, CI, and project structure without reading secret files.',
    async (_args, exec) => scanProject(sessionCwd(exec)),
  ))

  ctx.tools.register(toolDefinition(
    'smart_profile_recommend',
    'Inspect the current session workspace and return a minimal, explainable set of DeepSeek Harness capability categories that are likely useful for this project. This tool recommends capabilities, not untrusted third-party packages.',
    async (_args, exec) => {
      const scan = await scanProject(sessionCwd(exec))
      return {
        scan,
        recommendations: recommendProfile(scan),
      }
    },
  ))
}
