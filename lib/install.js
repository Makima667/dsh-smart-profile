import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
const DEFAULT_DSH = '@deepseek-ai/dsh@next'
const npxCommand = () => process.platform === 'win32' ? 'npx.cmd' : 'npx'
function hashText(text) { return text == null ? null : createHash('sha256').update(text).digest('hex') }
export function buildInstallPlan(candidate, { profile = 'web', dshSpec = DEFAULT_DSH } = {}) {
  if (!candidate?.name) throw new Error('Candidate package name is required.')
  const packageSpec = candidate.version ? `${candidate.name}@${candidate.version}` : candidate.name
  return { candidate: candidate.name, packageSpec, profile, commands: { snapshot: [npxCommand(), ['--yes', dshSpec, '--profile', profile, '--dump-config']], install: [npxCommand(), ['--yes', dshSpec, 'plugin', '--profile', profile, 'add', packageSpec]], verify: [npxCommand(), ['--yes', dshSpec, '--profile', profile, '--dump-config']], rollback: [npxCommand(), ['--yes', dshSpec, 'plugin', '--profile', profile, 'remove', candidate.name]] } }
}
export function defaultRunner(command, args) { return new Promise((resolve, reject) => { const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = ''; child.stdout.on('data', (chunk) => { stdout += chunk }); child.stderr.on('data', (chunk) => { stderr += chunk }); child.on('error', reject); child.on('exit', (code, signal) => signal ? reject(new Error(`Command terminated by ${signal}`)) : resolve({ code: code ?? 1, stdout, stderr })) }) }
function risky(candidate) { return (candidate.riskFlags ?? []).some((x) => x.startsWith('lifecycle-scripts')) }
function hasBundle(candidate) { return Boolean(candidate.metadata?.dsh?.bundle?.patch) }
export async function safeInstall(candidate, { profile = 'web', dshSpec = DEFAULT_DSH, approved = false, allowRisky = false, allowUndeclaredBundle = false, runner = defaultRunner } = {}) {
  const plan = buildInstallPlan(candidate, { profile, dshSpec })
  if (!approved) return { status: 'approval-required', plan, message: 'Re-run with explicit approval after reviewing the exact commands and candidate risk flags.' }
  if (risky(candidate) && !allowRisky) return { status: 'blocked-risk', plan, riskFlags: candidate.riskFlags, message: 'Lifecycle install scripts require an explicit allow-risky override.' }
  if (!hasBundle(candidate) && !allowUndeclaredBundle) return { status: 'blocked-not-bundle', plan, message: 'Candidate metadata does not declare dsh.bundle.patch.' }
  let before = null
  try { before = await runner(...plan.commands.snapshot) } catch { }
  if (before?.code === 0 && before.stdout?.includes(candidate.name)) return { status: 'already-present', plan, verified: true, beforeHash: hashText(before.stdout), message: 'Candidate already appears in the composed profile; no install or rollback action was taken.' }
  const install = await runner(...plan.commands.install)
  if (install.code !== 0) { let rollback = null; try { rollback = await runner(...plan.commands.rollback) } catch { } return { status: 'install-failed', plan, install: { code: install.code, stderr: install.stderr }, rollback: rollback ? { code: rollback.code } : null, beforeHash: hashText(before?.stdout) } }
  let verify
  try { verify = await runner(...plan.commands.verify) } catch (error) { verify = { code: 1, stdout: '', stderr: error.message } }
  const verified = verify.code === 0 && verify.stdout.includes(candidate.name)
  if (!verified) { let rollback; try { rollback = await runner(...plan.commands.rollback) } catch (error) { rollback = { code: 1, stderr: error.message } } return { status: 'verification-failed-rolled-back', plan, verify: { code: verify.code, stderr: verify.stderr }, rollback: { code: rollback.code, stderr: rollback.stderr }, beforeHash: hashText(before?.stdout), afterHash: hashText(verify.stdout) } }
  return { status: 'installed', plan, verified: true, beforeHash: hashText(before?.stdout), afterHash: hashText(verify.stdout), install: { code: install.code }, verify: { code: verify.code } }
}
