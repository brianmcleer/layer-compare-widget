require('./load.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { CompareSession } = require('../src/runtime/compare-session.ts')
const { buildCatalog, isCompareLayer } = require('../src/runtime/layer-model.ts')
const { layer, fixture, options, copyLayer } = require('./fixtures.cjs')
const tick = () => new Promise(resolve => setImmediate(resolve))

test('separate copies allow independent sublayers from one service; stopping restores exact visibility', async () => {
  const source = layer('service', 'map-image', { sublayers: [layer(0), layer(1, undefined, { visible: false })] })
  const other = layer('other', 'feature', { visible: false })
  const f = fixture([source, other]), tree = buildCatalog(f.map.layers, 'm')
  const session = new CompareSession(f.view, 'widget', f.adapters, () => {})
  const [A, B] = tree[0].leafKeys
  await session.apply(tree, { start: [A], end: [B] }, false, options)
  assert.equal(source.visible, false)
  assert.deepEqual(f.swipes[0].start[0].sublayers.map(s => s.visible), [true, false])
  assert.deepEqual(f.swipes[0].end[0].sublayers.map(s => s.visible), [false, true])
  assert.deepEqual(source.sublayers.map(s => s.visible), [true, false])
  assert.equal(new Set(f.map.layers.map(s => s.id)).size, f.map.layers.length)
  session.stop()
  assert.equal(source.visible, true)
  assert.equal(other.visible, false)
  assert.equal(f.map.layers.some(isCompareLayer), false)
  assert.equal(f.swipes[0].destroyed, true)
})

test('other visible sublayers become shared context without enabling previously hidden leaves', async () => {
  const source = layer('service', 'map-image', { sublayers: [layer(0), layer(1), layer(2), layer(3, undefined, { visible: false })] })
  const f = fixture([source, layer('context-root')]), tree = buildCatalog(f.map.layers, 'm')
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].leafKeys[0]], end: [tree[0].leafKeys[1]] }, true, options)
  assert.deepEqual(f.swipes[0].start[0].sublayers.map(x => x.visible), [true, false, true, false])
  assert.deepEqual(f.swipes[0].end[0].sublayers.map(x => x.visible), [false, true, true, false])
  assert.equal(tree[1].source.visible, true)
  s.dispose()
})

test('an empty side compares a layer with the basemap and updates without leaking copies', async () => {
  const f = fixture([layer('A'), layer('B')]), tree = buildCatalog(f.map.layers, 'm')
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  assert.equal(f.swipes[0].end.length, 0)
  await s.apply(tree, { start: [], end: [tree[1].key] }, false, options)
  assert.equal(f.map.layers.filter(isCompareLayer).length, 1)
  assert.equal(f.swipes[0].start.length, 0)
  s.dispose()
})

test('slider and direction updates never rebuild or reload copies', async () => {
  const f = fixture([layer('A')]), tree = buildCatalog(f.map.layers, 'm')
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  s.setOptions({ ...options, direction: 'vertical', position: 75 })
  assert.equal(f.copies, 1)
  assert.equal(f.swipes[0].options.position, 75)
  assert.equal(f.swipes[0].options.direction, 'vertical')
  s.dispose()
})

test('right-side preparation starts while the left side is still loading', async () => {
  const f = fixture(['A', 'B', 'C', 'D', 'E', 'Right'].map(id => layer(id))), tree = buildCatalog(f.map.layers, 'm')
  const started = [], finishes = []
  let released = false
  f.adapters.copyLayer = async source => {
    const copy = copyLayer(source)
    copy.load = () => {
      started.push(source.id)
      return released ? Promise.resolve(copy) : new Promise(resolve => { finishes.push(resolve) })
    }
    return copy
  }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  const pending = s.apply(tree, { start: tree.slice(0, 5).map(node => node.key), end: [tree[5].key] }, false, options)
  await tick()
  try {
    assert.equal(started.length, 4)
    assert.equal(started.includes('Right'), true)
  } finally { released = true; finishes.forEach(finish => finish()) }
  assert.equal(await pending, true)
  assert.deepEqual(f.swipes[0].start.map(copy => copy.title), ['A', 'B', 'C', 'D', 'E'])
  s.dispose()
})

test('changing only the right side preserves the left copy and swapping reuses both copies', async () => {
  const f = fixture([layer('A'), layer('B'), layer('C')]), tree = buildCatalog(f.map.layers, 'm')
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].key], end: [tree[1].key] }, false, options)
  const left = f.swipes[0].start[0], oldRight = f.swipes[0].end[0]
  await s.apply(tree, { start: [tree[0].key], end: [tree[2].key] }, false, options)
  const right = f.swipes[0].end[0]
  assert.equal(f.swipes[0].start[0], left)
  assert.equal(left.destroyed, false)
  assert.equal(oldRight.destroyed, true)
  assert.equal(f.copies, 3)
  await s.apply(tree, { start: [tree[2].key], end: [tree[0].key] }, false, options)
  assert.equal(f.swipes[0].start[0], right)
  assert.equal(f.swipes[0].end[0], left)
  assert.equal(f.copies, 3)
  assert.equal(f.map.layers.filter(isCompareLayer).length, 2)
  s.dispose()
  assert.equal(left.destroyed, true)
  assert.equal(right.destroyed, true)
})

test('MapServer preparation uses load without loading every hidden sublayer and table', async () => {
  const f = fixture([layer('service', 'map-image', { sublayers: [layer(0), layer(1)] })])
  const tree = buildCatalog(f.map.layers, 'm'), calls = []
  f.adapters.copyLayer = async source => {
    const copy = copyLayer(source)
    copy.load = async () => { calls.push('load'); return copy }
    copy.loadAll = async () => { throw new Error('Unnecessary sublayer/table load') }
    return copy
  }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].leafKeys[0]], end: [tree[0].leafKeys[1]] }, false, options)
  assert.deepEqual(calls, ['load', 'load'])
  assert.deepEqual(f.swipes[0].start[0].sublayers.map(x => x.visible), [true, false])
  assert.deepEqual(f.swipes[0].end[0].sublayers.map(x => x.visible), [false, true])
  s.dispose()
})

test('a failed concurrent preparation destroys every new copy and restores the originals', async () => {
  const f = fixture([layer('A'), layer('B')]), tree = buildCatalog(f.map.layers, 'm'), copies = []
  f.adapters.copyLayer = async source => {
    const copy = copyLayer(source); copies.push(copy)
    copy.load = async () => { if (source.id === 'B') throw new Error('offline'); return copy }
    return copy
  }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await assert.rejects(s.apply(tree, { start: [tree[0].key], end: [tree[1].key] }, false, options), /offline/)
  assert.equal(copies.length, 2)
  assert.equal(copies.every(copy => copy.destroyed), true)
  assert.equal(f.map.layers.length, 2)
  assert.equal(f.map.layers.every(source => source.visible), true)
  assert.equal(s.active, false)
  s.dispose()
})

test('existing layer-view filters are copied to the visible comparison copy', async () => {
  const root = layer('A'), f = fixture([root]), tree = buildCatalog(f.map.layers, 'm')
  const originalView = await f.view.whenLayerView(root)
  originalView.filter = { where: 'VALUE > 0', clone () { return { where: this.where } } }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  const copyView = await f.view.whenLayerView(f.swipes[0].start[0])
  assert.equal(copyView.filter.where, 'VALUE > 0')
  assert.notEqual(copyView.filter, originalView.filter)
  s.dispose()
})

test('failure during an update stops comparison and restores the map', async () => {
  const f = fixture([layer('A'), layer('B')]), tree = buildCatalog(f.map.layers, 'm')
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  await s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  f.adapters.copyLayer = async () => { throw new Error('service failure') }
  await assert.rejects(s.apply(tree, { start: [], end: [tree[1].key] }, false, options), /service failure/)
  assert.equal(f.map.layers.filter(isCompareLayer).length, 0)
  assert.equal(tree[0].source.visible, true)
  assert.equal(tree[1].source.visible, true)
  assert.equal(s.active, false)
})

test('closing during a slow load prevents late layers or a divider from appearing', async () => {
  const f = fixture([layer('A')]), tree = buildCatalog(f.map.layers, 'm')
  let finish
  f.adapters.copyLayer = async source => { const copy = copyLayer(source); copy.loadAll = () => new Promise(resolve => { finish = resolve }); return copy }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  const pending = s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  await tick()
  s.dispose(); finish()
  assert.equal(await pending, false)
  assert.equal(f.map.layers.length, 1)
  assert.equal(tree[0].source.visible, true)
  assert.equal(f.swipes.length, 0)
})

test('a later selection wins over an earlier slow load', async () => {
  const f = fixture([layer('A'), layer('B')]), tree = buildCatalog(f.map.layers, 'm')
  let finish
  f.adapters.copyLayer = async source => {
    const copy = copyLayer(source)
    if (source.id === 'A') copy.loadAll = () => new Promise(resolve => { finish = resolve })
    return copy
  }
  const s = new CompareSession(f.view, 'w', f.adapters, () => {})
  const first = s.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  await tick()
  assert.equal(await s.apply(tree, { start: [], end: [tree[1].key] }, false, options), true)
  finish(); assert.equal(await first, false)
  assert.equal(f.map.layers.filter(isCompareLayer).length, 1)
  assert.equal(f.swipes[0].end.length, 1)
  s.dispose()
})

test('two Layer Compare widgets cannot override visibility in the same map', async () => {
  const f = fixture([layer('A')]), tree = buildCatalog(f.map.layers, 'm')
  const first = new CompareSession(f.view, 'one', f.adapters, () => {})
  const second = new CompareSession(f.view, 'two', f.adapters, () => {})
  await first.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  await assert.rejects(second.apply(tree, { start: [], end: [tree[0].key] }, false, options), /Another Layer Compare/)
  second.dispose(); assert.equal(first.active, true)
  first.stop()
  const third = new CompareSession(f.view, 'three', f.adapters, () => {})
  await third.apply(tree, { start: [tree[0].key], end: [] }, false, options)
  third.dispose()
})
