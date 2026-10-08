require('./load.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { copyValue, createLayerCopier } = require('../src/runtime/layer-copy.ts')

test('collections deep-copy their members instead of sharing Collection.clone references', () => {
  const source = { visible: true, clone () { return { visible: this.visible } } }
  const collection = { toArray: () => [source], clone: () => [source] }
  const copies = copyValue(collection)
  assert.notEqual(copies[0], source)
  copies[0].visible = false
  assert.equal(source.visible, true)
})

test('MapImageLayer is reconstructed without requiring a nonexistent layer.clone method', async () => {
  const sourceSublayer = { id: 0, definitionExpression: 'VALUE > 0', visible: true, clone () { return { ...this } } }
  const source = { id: 'service', type: 'map-image', url: 'https://example.test/MapServer', sublayers: { toArray: () => [sourceSublayer] } }
  const copy = await createLayerCopier()(source)
  assert.equal(copy.type, 'map-image')
  assert.notEqual(copy.sublayers[0], sourceSublayer)
  assert.equal(copy.sublayers[0].id, 0)
  assert.equal(copy.sublayers[0].definitionExpression, 'VALUE > 0')
})

test('FeatureLayer source graphics and fields are copied without reparenting originals', async () => {
  const graphic = { attributes: { OBJECTID: 1 }, clone () { return { attributes: { ...this.attributes } } } }
  const source = { id: 'A', type: 'feature', source: { toArray: () => [graphic] }, fields: [{ name: 'OBJECTID', type: 'oid' }] }
  const copy = await createLayerCopier()(source)
  assert.notEqual(copy.source[0], graphic)
  assert.notEqual(copy.fields[0], source.fields[0])
  assert.equal(copy.persistenceEnabled, false)
})

test('group copies load only needed descendants, so an unrelated failed service cannot block comparison', async () => {
  const valid = { id: 'valid', type: 'feature', source: [], fields: [] }
  const unavailable = { id: 'unavailable', type: 'map-image', loadStatus: 'failed' }
  const group = { id: 'group', type: 'group', layers: [valid, unavailable] }
  const copy = await createLayerCopier()(group, source => source !== unavailable)
  assert.equal(copy.layers.length, 1)
  assert.equal(copy.layers[0].id, 'valid')
})
