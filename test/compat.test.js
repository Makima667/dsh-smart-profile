import assert from 'node:assert/strict'
import test from 'node:test'
import { checkDshCompatibility, compatibilityReport, normalizeDshTarget } from '../lib/compat.js'

test('v0.6 normalizes channels and explicit package targets', () => {
  assert.deepEqual(normalizeDshTarget('@deepseek-ai/dsh@next'), { channel: 'next', version: null, label: 'next' })
  assert.deepEqual(normalizeDshTarget('v0.1.0-rc.7'), { channel: null, version: '0.1.0-rc.7', label: '0.1.0-rc.7' })
})

test('v0.6 never upgrades a CI target to verified without evidence', async () => {
  const report = await compatibilityReport('next')
  assert.equal(report.result.status, 'ci-target')
  assert.equal(report.result.verified, false)
  assert.ok(report.result.node.includes('20'))
})

test('v0.6 exact unrecorded versions remain unknown', () => {
  const result = checkDshCompatibility('9.9.9', { channels: {}, policy: { unknownVersions: 'unknown' } })
  assert.equal(result.status, 'unknown')
  assert.equal(result.verified, false)
  assert.equal(result.requiresRuntimeVerification, true)
})
