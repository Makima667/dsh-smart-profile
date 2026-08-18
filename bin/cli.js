#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { formatRecommendations, formatScan, recommendProfile, scanProject } from '../lib/core.js'
import { discoverCandidates } from '../lib/discovery.js'
const PACKAGE_NAME = 'dsh-smart-profile'
const VERSION = '0.3.0'
function usage() { console.log(`dsh-smart-profile ${VERSION}\n\nUsage:\n  dsh-smart-profile scan [path] [--json]\n  dsh-smart-profile recommend [path] [--json]\n  dsh-smart-profile discover [path] [--json]\n  dsh-smart-profile install [--profile web] [--version latest]\n  dsh-smart-profile uninstall [--profile web]\n`) }
function argValue(args, flag, fallback) { const i = args.indexOf(flag); return i === -1 ? fallback : (args[i + 1] ?? fallback) }
function positionalPath(args) { return args.find((arg, i) => i > 0 && !arg.startsWith('-') && !['--profile', '--version'].includes(args[i - 1])) }
function run(command, args) { return new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: 'inherit', shell: false }); child.on('error', reject); child.on('exit', (code, signal) => signal ? reject(new Error(`Command terminated by ${signal}`)) : resolve(code ?? 1)) }) }
async function runDshPlugin(action, profile, spec) { const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'; const args = ['--yes', '@deepseek-ai/dsh@next', 'plugin', '--profile', profile, action, spec]; console.log(`> ${npx} ${args.join(' ')}`); const code = await run(npx, args); if (code !== 0) process.exitCode = code }
async function main() {
  const args = process.argv.slice(2), command = args[0]
  if (!command || ['--help', '-h', 'help'].includes(command)) return usage()
  if (['scan', 'recommend', 'discover'].includes(command)) {
    const scan = await scanProject(path.resolve(positionalPath(args) ?? '.'))
    if (command === 'scan') return console.log(args.includes('--json') ? JSON.stringify(scan, null, 2) : formatScan(scan))
    const recommendations = recommendProfile(scan)
    if (command === 'recommend') return console.log(args.includes('--json') ? JSON.stringify({ scan, recommendations }, null, 2) : formatRecommendations(scan, recommendations))
    const discovery = await discoverCandidates(recommendations)
    return console.log(JSON.stringify({ scan, recommendations, discovery }, null, 2))
  }
  if (command === 'install') return runDshPlugin('add', argValue(args, '--profile', 'web'), `${PACKAGE_NAME}@${argValue(args, '--version', 'latest')}`)
  if (command === 'uninstall') return runDshPlugin('remove', argValue(args, '--profile', 'web'), PACKAGE_NAME)
  throw new Error(`Unknown command: ${command}`)
}
main().catch((error) => { console.error(`[dsh-smart-profile] ${error.message}`); process.exitCode = 1 })
