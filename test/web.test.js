import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildDashboardData, renderDashboard, startDashboard } from '../lib/web.js'
async function fixture() { const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-smart-profile-web-')); await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' }, devDependencies: { typescript: '5.0.0' } })); return root }
test('v0.8 dashboard renders project profile and escapes untrusted text', () => { const html = renderDashboard({ generatedAt: 'now', scan: { root: '<script>alert(1)</script>', summary: { languages: ['TypeScript'] } }, recommendations: [{ id: 'browser', title: '<Browser>', priority: 'high', reason: 'UI' }], composition: null }); assert.match(html, /dsh-smart-profile/); assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;Browser&gt;')) })
test('v0.8 dashboard refuses remote binding by default', async () => { await assert.rejects(() => startDashboard({ host: '0.0.0.0', port: 0 }), /Refusing to bind/) })
test('v0.8 profile API is read-only and returns detected stack', async () => { const root = await fixture(); let dashboard; try { const data = await buildDashboardData(root, 'fix frontend UI'); assert.ok(data.scan.summary.languages.includes('TypeScript')); assert.ok(data.composition.selected.some((x) => x.id === 'browser')); dashboard = await startDashboard({ root, port: 0 }); const response = await fetch(`${dashboard.url}/api/profile?task=${encodeURIComponent('fix frontend UI')}`); assert.equal(response.status, 200); const body = await response.json(); assert.ok(body.composition.selected.some((x) => x.id === 'browser')) } finally { if (dashboard?.server) await new Promise((resolve) => dashboard.server.close(resolve)); await rm(root, { recursive: true, force: true }) } })
