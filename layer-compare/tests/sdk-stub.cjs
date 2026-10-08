const names = { FeatureLayer: 'feature', MapImageLayer: 'map-image', GroupLayer: 'group', TileLayer: 'tile' }
exports.loadArcGISJSAPIModules = async paths => paths.map(modulePath => {
  const type = names[modulePath.split('/').pop()]
  return class {
    constructor (properties) { Object.assign(this, { type }, properties) }
    async load () { return this }
    async loadAll () { return this }
    destroy () { this.destroyed = true }
  }
})
