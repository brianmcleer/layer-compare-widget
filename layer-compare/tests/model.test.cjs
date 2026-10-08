require('./load.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const model = require('../src/runtime/layer-model.ts')
const { layer, copyLayer } = require('./fixtures.cjs')

test('nested groups and MapServer sublayers have distinct stable keys, including sublayer zero', () => {
  const service = layer('service', 'map-image', { sublayers: [layer(0, undefined), layer(1, undefined)] })
  const tree = model.buildCatalog([layer('group', 'group', { layers: [service] })], 'map-A')
  assert.equal(tree[0].leafKeys.length, 2)
  assert.ok(tree[0].leafKeys[0].endsWith('/sublayer:0'))
  assert.equal(model.buildCatalog([service], 'map-B')[0].leafKeys.some(key => tree[0].leafKeys.includes(key)), false)
})

test('hidden layers and hidden descendants cannot leak into a group selection', () => {
  const tree = model.buildCatalog([layer('group', 'group', { layers: [layer('visible'), layer('hidden', 'feature', { listMode: 'hide' })] }),
    layer('layer-compare__temporary'), layer('hidden-root', 'group', { listMode: 'hide', layers: [layer('child')] })], 'm')
  assert.equal(tree.length, 2)
  assert.equal(tree[0].leafKeys.length, 1)
  assert.equal(tree[1].leafKeys.length, 0)
  assert.equal(model.listedTree(tree).length, 1)
})

test('builder exclusions prune descendants and stale saved keys', () => {
  const roots = [layer('group', 'group', { layers: [layer('A'), layer('B')] })]
  const initial = model.buildCatalog(roots, 'm')
  const tree = model.buildCatalog(roots, 'm', [initial[0].leafKeys[0]])
  assert.deepEqual(model.normalizeSelection([...initial[0].leafKeys, 'stale'], tree), [initial[0].leafKeys[1]])
})

test('parent checkboxes reflect partial choices and select or clear all eligible children', () => {
  const root = model.buildCatalog([layer('group', 'group', { layers: [layer('A'), layer('B')] })], 'm')[0]
  assert.deepEqual(model.selectionState(root, [root.leafKeys[0]]), { checked: false, partial: true })
  assert.deepEqual(model.toggleNode(root, [root.leafKeys[0]]), root.leafKeys)
  assert.deepEqual(model.toggleNode(root, root.leafKeys), [])
})

test('filtering preserves selection keys and keeps matching ancestors', () => {
  const tree = model.buildCatalog([layer('group', 'group', { layers: [layer('A'), layer('B')] })], 'm')
  assert.equal(model.filterTree(model.listedTree(tree), 'B')[0].children[0].title, 'B')
  assert.equal(tree[0].leafKeys.length, 2)
})

test('cached tiled services and subtype layers remain indivisible endpoints', () => {
  const tree = model.buildCatalog([layer('cached', 'tile', { sublayers: [layer(1)] }), layer('subtypes', 'subtype-group', { sublayers: [layer(2)] })], 'm')
  assert.equal(tree[0].children.length, 0)
  assert.equal(tree[1].children.length, 0)
  assert.equal(tree[0].leafKeys.length, 1)
})

test('MapServer masks activate the selected hidden leaf and its ancestors, with no sibling leakage', () => {
  const source = layer('service', 'map-image', { visible: false, sublayers: [layer(0, undefined, { visible: false, sublayers: [layer(1), layer(2)] }), layer(3)] })
  const node = model.buildCatalog([source], 'm')[0]
  const copy = copyLayer(source)
  const key = node.children[0].children[1].key
  model.applyMask(node, copy, new Set([key]))
  assert.equal(copy.visible, true)
  assert.equal(copy.sublayers[0].visible, true)
  assert.equal(copy.sublayers[0].sublayers[0].visible, false)
  assert.equal(copy.sublayers[0].sublayers[1].visible, true)
  assert.equal(copy.sublayers[1].visible, false)
  assert.equal(source.visible, false)
  assert.equal(source.sublayers[0].visible, false)
})

test('shared context follows original visibility through all ancestors', () => {
  const node = model.buildCatalog([layer('root', 'group', { layers: [layer('A'), layer('off', 'group', { visible: false, layers: [layer('B')] })] })], 'm')[0]
  assert.deepEqual(model.visibleLeafKeys(node, true), [node.children[0].key])
  assert.deepEqual(model.visibleLeafKeys(node, false), [])
})

test('group copies use independent visibility and Swipe receives real rendering layers', () => {
  const root = layer('root', 'group', { visibilityMode: 'exclusive', layers: [layer('A'), layer('B')] })
  const tree = model.buildCatalog([root], 'm')
  const copy = copyLayer(root)
  model.applyMask(tree[0], copy, new Set(tree[0].leafKeys))
  assert.equal(copy.visibilityMode, 'independent')
  assert.equal(root.visibilityMode, 'exclusive')
  assert.equal(model.renderingLayers(copy).length, 2)
})
