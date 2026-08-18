#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { formatRecommendations, formatScan, recommendProfile, scanProject } from '../lib/core.js'

const PACKAGE_NAME = 'dsh-smart-profile'

function usage() {
  console.log(`dsh-smart-profile 0.1.0

Usage:
  dsh-smart-profile scan [path] [--json]
  dsh-smart-profile recommend [path] [--json]
  dsh-smart-profile install [--profile web] [--version latest]
  dsh-smart-profile uninstall [--profile web]

Examples:
  npx dsh-smart-profile scan
  npx dsh-smart-profile recommend . --json
  npm exec --yes dsh-smart-profile@latest -- install --profile web
`)
}

function argValue(args, flag, fallback) {
  const index = args.indexOf(flag)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function positionalPath(args) {
  return args.find((arg, index) => index > 0 && !arg.startsWith('-') && args[index - 1] !== '--profile' && args[index - 1] !== '--version')
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Command terminated by ${signal}`))
      else resolve(code ?? 1)
    })
  })
}

async function runDshPlugin(action, profile, spec) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const args = ['--yes', '@deepseek-ai/dsh@next', 'plugin', '--profile', profile, action, spec]
  console.log(`> ${npx} ${args.join(' ')}`)
  const code = await run(npx, args)
  if (code !== 0) process.exitCode = code
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    usage()
    return
  }

  if (command === 'scan' || command === 'recommend') {
    const input = positionalPath(args) ?? '.'
    const root = path.resolve(input)
    const scan = await scanProject(root)
    if (command === 'scan') {
      console.log(args.includes('--json') ? JSON.stringify(scan, null, 2) : formatScan(scan))
      return
    }
    const recommendations = recommendProfile(scan)
    console.log(args.includes('--json')
      ? JSON.stringify({ scan, recommendations }, null, 2)
      : formatRecommendations(scan, recommendations))
    return
  }

  if (command === 'install') {
    const profile = argValue(args, '--profile', 'web')
    const version = argValue(args, '--version', 'latest')
    await runDshPlugin('add', profile, `${PACKAGE_NAME}@${version}`)
    return
  }

  if (command === 'uninstall') {
    const profile = argValue(args, '--profile', 'web')
    await runDshPlugin('remove', profile, PACKAGE_NAME)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(`[dsh-smart-profile] ${error.message}`)
  process.exitCode = 1
})
