import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../index.js'
import { recommendProfile, scanProject } from '../lib/core.js'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-smart-profile-'))
  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    dependencies: {
      next: '15.0.0',
      react: '19.0.0',
      pg: '8.0.0',
    },
    devDependencies: {
      typescript: '5.0.0',
      '@playwright/test': '1.0.0',
    },
  }))
  await writeFile(path.join(root, 'Dockerfile'), 'FROM node:22-alpine\n')
  await mkdir(path.join(root, '.github', 'workflows'), { recursive: true })
  await writeFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
  await writeFile(path.join(root, '.env'), 'SECRET=do-not-read-this\n')
  return root
}

test('scanProject detects common stack signals', async () => {
  const root = await fixture()
  try {
    const scan = await scanProject(root)
    assert.ok(scan.summary.languages.includes('TypeScript'))
    assert.ok(scan.summary.frameworks.includes('Next.js'))
    assert.ok(scan.summary.databases.includes('PostgreSQL'))
    assert.ok(scan.summary.infrastructure.includes('Docker'))
    assert.ok(scan.summary.ci.includes('GitHub Actions'))
    assert.ok(scan.summary.testing.includes('Playwright'))
    assert.equal(scan.limits.secretFilesRead, false)
    assert.ok(!scan.evidence.includes('.env'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('recommendProfile returns explainable capability categories', async () => {
  const root = await fixture()
  try {
    const scan = await scanProject(root)
    const ids = recommendProfile(scan).map((item) => item.id)
    assert.ok(ids.includes('browser'))
    assert.ok(ids.includes('database'))
    assert.ok(ids.includes('containers'))
    assert.ok(ids.includes('github'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('plugin registers two Harness tools and uses the session cwd', async () => {
  const root = await fixture()
  try {
    const tools = []
    apply({ tools: { register(definition) { tools.push(definition) } } })
    assert.equal(tools.length, 2)
    assert.deepEqual(tools.map((tool) => tool.name), ['smart_profile_scan', 'smart_profile_recommend'])

    const scanTool = tools[0]
    const result = await scanTool.execute({}, { agent: { session: { header: { cwd: root } } } })
    assert.equal(result.root, root)
    assert.ok(result.summary.frameworks.includes('Next.js'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
