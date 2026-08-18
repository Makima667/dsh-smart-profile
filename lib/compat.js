import { readFile } from 'node:fs/promises'

const MATRIX_URL = new URL('../compatibility.json', import.meta.url)

export async function loadCompatibilityMatrix() {
  return JSON.parse(await readFile(MATRIX_URL, 'utf8'))
}

export function normalizeDshTarget(input = 'next') {
  const value = String(input).trim()
  if (!value) return { channel: 'next', version: null, label: 'next' }
  if (value === 'next' || value === 'latest') return { channel: value, version: null, label: value }
  const stripped = value.replace(/^@deepseek-ai\/dsh@/, '').replace(/^v/, '')
  if (stripped === 'next' || stripped === 'latest') return { channel: stripped, version: null, label: stripped }
  return { channel: null, version: stripped, label: stripped }
}

export function checkDshCompatibility(target, matrix) {
  const normalized = normalizeDshTarget(target)
  if (normalized.channel && matrix?.channels?.[normalized.channel]) {
    const entry = matrix.channels[normalized.channel]
    return {
      target: normalized.label,
      status: entry.status,
      node: entry.node ?? [],
      note: entry.note ?? null,
      verified: entry.status === 'verified',
      requiresRuntimeVerification: true,
    }
  }
  return {
    target: normalized.label,
    status: matrix?.policy?.unknownVersions ?? 'unknown',
    node: [],
    note: 'This exact DSH target is not declared in the local compatibility matrix. Treat it as unknown until CI or a local dump-config check verifies it.',
    verified: false,
    requiresRuntimeVerification: true,
  }
}

export async function compatibilityReport(target = 'next') {
  const matrix = await loadCompatibilityMatrix()
  return { matrix, result: checkDshCompatibility(target, matrix) }
}
