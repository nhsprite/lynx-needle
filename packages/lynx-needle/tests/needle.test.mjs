import assert from 'node:assert/strict'
import test from 'node:test'

import { createNeedle, loadNeedle } from '../lib/needle.js'

function response(overrides = {}) {
  return {
    type: 'respond',
    success: true,
    error: null,
    error_code: null,
    function_calls: [],
    confidence: 0.9,
    ...overrides,
  }
}

function fakeAddon(responses = []) {
  const completeInputs = []
  const initInputs = []

  const addon = {
    completeInputs,
    initInputs,
    init(...args) {
      assert.equal(this, addon)
      initInputs.push(args)
    },
    async complete(input, maxNewTokens) {
      assert.equal(this, addon)
      completeInputs.push([input, maxNewTokens])
      return responses.shift() ?? response()
    },
    reset() {},
    load() {},
    engineVersion() {
      return '2.0.3'
    },
  }

  return addon
}

test('createNeedle rejects an unavailable addon', () => {
  assert.throws(
    () => createNeedle(null),
    /Needle addon not loaded/,
  )
})

test('run executes handlers and feeds their results back to the engine', async () => {
  const addon = fakeAddon([
    response({
      type: 'call',
      function_calls: [
        { name: 'add', arguments: { left: 2, right: 3 } },
        { name: 'missing', arguments: {} },
        { name: 'explode', arguments: {} },
      ],
    }),
    response({ confidence: 0.95 }),
  ])
  const needle = createNeedle(addon)

  const result = await needle.run(
    'run the tools',
    {
      add: async ({ left, right }) => left + right,
      explode: () => {
        throw new Error('boom')
      },
    },
    { maxNewTokens: 64 },
  )

  const toolResults = [
    5,
    { error: 'unknown tool: missing' },
    { error: 'boom' },
  ]
  assert.deepEqual(addon.completeInputs, [
    ['run the tools', 64],
    [JSON.stringify(toolResults), 64],
  ])
  assert.deepEqual(result.results, toolResults)
  assert.equal(result.type, 'respond')
  assert.equal(result.confidence, 0.95)
})

test('run stops after maxSteps while preserving executed results', async () => {
  const addon = fakeAddon([
    response({
      type: 'call',
      function_calls: [{ name: 'next', arguments: { value: 1 } }],
    }),
    response({
      type: 'call',
      function_calls: [{ name: 'next', arguments: { value: 2 } }],
    }),
  ])
  const needle = createNeedle(addon)

  const result = await needle.run(
    'start',
    { next: ({ value }) => value },
    { maxSteps: 1 },
  )

  assert.deepEqual(result.results, [1])
  assert.equal(result.type, 'call')
  assert.equal(addon.completeInputs.length, 2)
})

test('extract initializes a one-tool session and returns its arguments', async () => {
  const addon = fakeAddon([
    response({
      type: 'call',
      function_calls: [{ name: 'Invoice', arguments: { total: 1200 } }],
    }),
  ])
  const needle = createNeedle(addon)
  const schema = {
    name: 'Invoice',
    parameters: {
      type: 'object',
      properties: { total: { type: 'number' } },
      required: ['total'],
    },
  }

  const result = await needle.extract('invoice text', schema, {
    system: 'extract invoices',
    maxNewTokens: 32,
  })

  assert.deepEqual(addon.initInputs, [['extract invoices', [schema]]])
  assert.deepEqual(addon.completeInputs, [['invoice text', 32]])
  assert.deepEqual(result, { total: 1200 })
})

test('extract returns null when the engine emits no function call', async () => {
  const needle = createNeedle(fakeAddon([response()]))

  assert.equal(
    await needle.extract('not an invoice', {
      name: 'Invoice',
      parameters: { type: 'object' },
    }),
    null,
  )
})

test('loadNeedle returns null when no AutoLink loader is installed', async () => {
  const originalError = console.error
  const errors = []
  console.error = (...args) => errors.push(args)

  try {
    assert.equal(await loadNeedle(1), null)
  } finally {
    console.error = originalError
  }

  assert.equal(errors.length, 1)
  assert.match(String(errors[0][0]), /AutoLink NAPI addon unavailable/)
})
