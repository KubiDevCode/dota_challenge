const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { resolve } = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')
const { test } = require('node:test')

test('standalone worker loads shared and stays alive without external services', { timeout: 10_000 }, async (t) => {
  const child = spawn(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const exited = once(child, 'exit')
  t.after(async () => { child.kill(); await exited })
  let output = ''
  let errors = ''
  child.stdout.on('data', (data) => { output += data.toString() })
  child.stderr.on('data', (data) => { errors += data.toString() })
  for (let attempts = 0; attempts < 100 && !output.includes('worker started'); attempts++) {
    if (child.exitCode !== null) break
    await delay(50)
  }
  assert.match(output, /Aegis Trials worker started \(idle; no queues connected\)/, errors)
  await delay(150)
  assert.equal(child.exitCode, null, errors)
})
