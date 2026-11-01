// Run with: node --test tests/localModel.test.cjs
// Exercise the service against a controlled native boundary, without a phone.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function service(options = {}) {
  const events = []
  let inspections = 0
  let currentConfig
  class File {
    constructor(...parts) { this.uri = parts.map((part) => part.uri ?? part).join('/') }
    get exists() { return /\.(litertlm|wav|jpg)$/.test(this.uri) }
    get size() { return options.fileSize ?? 2588147712 }
    delete() { events.push('delete-temp') }
  }
  class Directory { constructor(...parts) { this.uri = parts.join('/') } }
  const runtime = {
    inspectModel: async () => {
      inspections++
      return {}
    },
    getDeviceInfo: () => ({}),
    recommendBackend: () => ({ compatible: true, candidates: ['cpu', 'gpu'] }),
    estimateMemory: ({ availableMemoryBytes }) => ({ verdict: availableMemoryBytes < 3.2e9 ? 'critical' : 'safe' }),
    createLLM: () => {
      events.push('create')
      return {
        loadModel: async (_path, config) => {
          currentConfig = config
          events.push(['load', config])
          if (options.loadError) throw new Error('engine initialization failed')
        },
        unload: async () => { events.push('unload') },
        close: () => { events.push('close') },
        isReady: () => options.ready !== false,
        getMemoryUsage: () => ({ isLowMemory: false, availableMemoryBytes: options.free ?? 8e9 }),
        getModelInfo: () => ({ modalities: { vision: true, audio: true } }),
        getMemoryForecast: () => null,
        getContextTokenCount: () => 16,
        createConversation: () => ({
          release: async () => { events.push('release') },
          execute: async (parts, token) => {
            assert.equal(parts.some((part) => part.type !== 'text'), currentConfig.multimodal)
            events.push('execute-start')
            await options.execute?.()
            token('Hello', false)
            events.push('execute-end')
          },
        }),
      }
    },
  }
  const modules = {
    'expo-file-system': { File, Directory, Paths: { document: 'file:///app' } },
    expo: { requireOptionalNativeModule: () => ({
      scan: async () => ({ arm64: true, androidApi: 35, totalRamBytes: 12e9, availableRamBytes: options.free ?? 8e9, lowMemory: false, npuDetected: true, gpuAvailable: true, ...options.scan }),
      prepareAudio: async () => '/app/temp.wav',
      prepareImage: async () => '/app/resized.jpg',
    }) },
    'expo-device': { isDevice: true, totalMemory: 12e9 },
    'react-native': { Platform: { OS: options.os ?? 'android' }, TurboModuleRegistry: { get: () => ({}) } },
    'react-native-litert-lm': runtime,
    react: {},
  }
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync('src/services/localModel.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, { exports, require: (id) => {
    assert.ok(id in modules, `Unexpected dependency ${id}`)
    return modules[id]
  } })
  return { api: exports, events, inspections: () => inspections }
}

const request = (media = {}) => ({ system: 'You are GabAI.', history: [{ role: 'user', text: 'Hello', ...media }], nPredict: 64 })

test('low free RAM refuses loading despite high total RAM', async () => {
  const { api, events, inspections } = service({ free: 2e9 })
  await assert.rejects(api.loadLocalModel(), /Not enough free memory/)
  assert.equal(inspections(), 0, 'native metadata parsing must not run before the memory guard')
  assert.equal(events.length, 0)
  assert.equal(api.getLocalModelStatus(), 'downloaded')
})

test('older native builds without free-memory readings cannot enter the model parser', async () => {
  const { api, inspections } = service({ scan: { availableRamBytes: undefined } })
  await assert.rejects(api.loadLocalModel(), /Not enough free memory/)
  assert.equal(inspections(), 0)
})

test('unsupported Android ABI is refused before inspecting the model', async () => {
  const { api, inspections } = service({ scan: { arm64: false } })
  await assert.rejects(api.loadLocalModel(), /supported device/)
  assert.equal(inspections(), 0)
})

test('iOS checks remaining app memory instead of total device RAM before inspection', async () => {
  const { api, events, inspections } = service({ os: 'ios', free: 2e9 })
  await assert.rejects(api.loadLocalModel(), /Not enough free memory/)
  assert.equal(inspections(), 0)
  assert.deepEqual(events, ['create', 'close'])
})

test('truncated model files are rejected before native inspection', async () => {
  const { api, events, inspections } = service({ fileSize: 1000 })
  await assert.rejects(api.loadLocalModel(), /model file is incomplete/)
  assert.equal(inspections(), 0)
  assert.equal(events.length, 0)
})

test('an engine released by memory pressure during load is not marked ready', async () => {
  const { api, events } = service({ ready: false })
  await assert.rejects(api.loadLocalModel(), /released.*low on memory/)
  assert.equal(api.getLocalModelStatus(), 'downloaded')
  assert.deepEqual(events.slice(-2), ['unload', 'close'])
})

test('settings loads text only with memory checks; unsupported NPU falls back', async () => {
  const { api, events } = service()
  await api.loadLocalModel('npu')
  const config = events.find((item) => Array.isArray(item))[1]
  assert.equal(config.backend, 'cpu')
  assert.equal(config.multimodal, false)
  assert.equal(config.forceLoad, false)
})

for (const media of [{}, { imageUri: 'file:///app/photo.jpg' }, { audioUri: 'file:///app/voice.m4a' }]) {
  test(`generation handles ${Object.keys(media)[0] ?? 'text'} and cleans up temporary media`, async () => {
    const { api, events } = service()
    await api.loadLocalModel()
    const reply = await api.generateLocal(request(media))
    assert.equal(reply.text, 'Hello')
    if (media.audioUri || media.imageUri) assert.ok(events.includes('delete-temp'))
    if (Object.keys(media).length) {
      assert.ok(events.indexOf('unload') < events.lastIndexOf('create'))
    }
  })
}

test('unload waits for a reply to finish using native state', async () => {
  let finish
  let started
  const pending = new Promise((resolve) => { finish = resolve })
  const running = new Promise((resolve) => { started = resolve })
  const { api, events } = service({ execute: () => { started(); return pending } })
  const reply = api.generateLocal(request())
  await running
  const unload = api.unloadEngine()
  await Promise.resolve()
  assert.ok(!events.includes('unload'))
  finish()
  await Promise.all([reply, unload])
  assert.ok(events.indexOf('execute-end') < events.indexOf('unload'))
  assert.equal(api.getLocalModelStatus(), 'downloaded')
})

test('media upgrade refuses insufficient encoder headroom and cleans up', async () => {
  const { api, events } = service({ free: 4e9 })
  await api.loadLocalModel()
  await assert.rejects(api.generateLocal(request({ imageUri: 'file:///app/photo.jpg' })), /Not enough free memory/)
  assert.equal(events.filter((item) => item === 'create').length, 1)
  assert.ok(events.includes('delete-temp'))
})

test('an aborted queued reply never calls the engine', async () => {
  const { api, events } = service()
  const result = await api.generateLocal({ ...request(), signal: { aborted: true } })
  assert.equal(result.text, '')
  assert.equal(events.length, 0)
})

test('failed loading frees the instance and leaves the queue usable', async () => {
  const { api, events } = service({ loadError: true })
  await assert.rejects(api.loadLocalModel(), /engine initialization failed/)
  assert.deepEqual(events.slice(-2), ['unload', 'close'])
  await api.unloadEngine()
  assert.equal(api.getLocalModelStatus(), 'downloaded')
})
