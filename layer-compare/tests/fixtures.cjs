function layer (id, type = 'feature', properties = {}) {
  return { id, type, title: id, visible: true, listMode: 'show', loadStatus: 'loaded', ...properties }
}
function copyLayer (source) {
  const copy = { ...source, destroyed: false }
  if (source.layers) copy.layers = source.layers.map(copyLayer)
  if (source.sublayers) copy.sublayers = source.sublayers.map(copyLayer)
  copy.loadAll = async () => copy
  copy.destroy = () => { copy.destroyed = true }
  return copy
}
function fixture (roots) {
  const layers = [...roots]
  const layerViews = new Map()
  const map = {
    layers,
    addMany: copies => layers.push(...copies),
    remove: copy => { const index = layers.indexOf(copy); if (index >= 0) layers.splice(index, 1) },
    reorder: (copy, target) => { const index = layers.indexOf(copy); if (index >= 0) layers.splice(index, 1); layers.splice(target, 0, copy) }
  }
  const view = { type: '2d', map, async whenLayerView (source) {
    if (!layerViews.has(source)) layerViews.set(source, { layer: source, filter: null, featureEffect: null })
    return layerViews.get(source)
  } }
  const swipes = []
  let copies = 0
  const adapters = {
    async copyLayer (source) { copies++; return copyLayer(source) },
    async createSwipe (v, callback, start, end, options) {
      const swipe = {
        start, end, options, destroyed: false,
        setLayers (left, right) { this.start = left; this.end = right },
        setOptions (next) { this.options = next },
        destroy () { this.destroyed = true }
      }
      swipes.push(swipe)
      return swipe
    }
  }
  return { map, view, adapters, swipes, layerViews, get copies () { return copies } }
}
const options = { direction: 'horizontal', position: 50, startLabel: 'Left', endLabel: 'Right' }
module.exports = { layer, copyLayer, fixture, options }
