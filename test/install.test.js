import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInstallPlan, safeInstall } from '../lib/install.js'

const candidate = { name: 'dsh-safe-demo', version: '1.2.3', riskFlags: [], metadata: { dsh: { bundle: { patch: './cordis.patch.yml' } } } }

test('v0.5 install plan is non-executing and pins candidate version', () => {
  const plan = buildInstallPlan(candidate, { profile: 'demo' })
  assert.ok(plan.commands.install[1].includes('dsh-safe-demo@1.2.3'))
  assert.ok(plan.commands.verify[1].includes('--dump-config'))
  assert.ok(plan.commands.rollback[1].includes('remove'))
})

test('v0.5 safeInstall requires explicit approval', async () => {
  let called = 0
  const result = await safeInstall(candidate, { runner: async () => { called += 1; return { code: 0, stdout: '' } } })
  assert.equal(result.status, 'approval-required')
  assert.equal(called, 0)
})

test('v0.5 verification failure triggers rollback', async () => {
  const calls = []
  const runner = async (_cmd, args) => {
    calls.push(args)
    if (args.includes('add')) return { code: 0, stdout: '', stderr: '' }
    if (args.includes('remove')) return { code: 0, stdout: '', stderr: '' }
    return { code: 0, stdout: '# config without candidate', stderr: '' }
  }
  const result = await safeInstall(candidate, { approved: true, runner })
  assert.equal(result.status, 'verification-failed-rolled-back')
  assert.ok(calls.some((args) => args.includes('remove')))
})

test('v0.5 lifecycle scripts are blocked unless explicitly allowed', async () => {
  const risky = { ...candidate, riskFlags: ['lifecycle-scripts:postinstall'] }
  const result = await safeInstall(risky, { approved: true, runner: async () => ({ code: 0, stdout: '' }) })
  assert.equal(result.status, 'blocked-risk')
})
