import { loadArcGISJSAPIModules } from 'jimu-arcgis'
import { asArray } from './layer-model'

const MODULES: Record<string, string> = {
  feature: 'FeatureLayer', 'map-image': 'MapImageLayer', group: 'GroupLayer',
  imagery: 'ImageryLayer', 'imagery-tile': 'ImageryTileLayer', tile: 'TileLayer',
  'vector-tile': 'VectorTileLayer', 'web-tile': 'WebTileLayer', wms: 'WMSLayer',
  wmts: 'WMTSLayer', geojson: 'GeoJSONLayer', csv: 'CSVLayer',
  'ogc-feature': 'OGCFeatureLayer', 'subtype-group': 'SubtypeGroupLayer'
}

const COMMON = ['title', 'opacity', 'minScale', 'maxScale', 'blendMode', 'effect',
  'visible', 'legendEnabled', 'refreshInterval', 'popupEnabled', 'visibilityTimeExtent']
const SERVICE = ['url', 'portalItem', 'apiKey', 'customParameters', 'timeExtent', 'timeOffset', 'useViewTime']
const SPECIFIC: Record<string, string[]> = {
  feature: ['definitionExpression', 'renderer', 'fields', 'objectIdField', 'globalIdField',
    'geometryType', 'spatialReference', 'source', 'outFields', 'labelingInfo', 'labelsVisible',
    'popupTemplate', 'featureReduction', 'fieldConfigurations', 'formTemplate', 'gdbVersion'],
  'map-image': ['sublayers', 'imageFormat', 'imageTransparency', 'imageMaxWidth', 'imageMaxHeight', 'dpi', 'gdbVersion'],
  imagery: ['renderer', 'rasterFunction', 'mosaicRule', 'format', 'compressionQuality', 'bandIds',
    'interpolation', 'popupTemplate', 'definitionExpression'],
  'imagery-tile': ['renderer', 'rasterFunction', 'bandIds', 'interpolation', 'popupTemplate', 'multidimensionalDefinition'],
  tile: ['sublayers', 'resampling', 'tileInfo', 'spatialReference', 'fullExtent'],
  'vector-tile': ['style', 'currentStyleInfo'],
  'web-tile': ['urlTemplate', 'subDomains', 'tileInfo', 'spatialReference', 'fullExtent', 'copyright'],
  wms: ['sublayers', 'imageFormat', 'featureInfoFormat', 'featureInfoUrl', 'version'],
  wmts: ['activeLayer', 'serviceMode', 'version'],
  geojson: ['renderer', 'definitionExpression', 'fields', 'outFields', 'labelingInfo', 'labelsVisible', 'popupTemplate'],
  csv: ['renderer', 'definitionExpression', 'fields', 'outFields', 'labelingInfo', 'labelsVisible',
    'popupTemplate', 'delimiter', 'latitudeField', 'longitudeField'],
  'ogc-feature': ['collectionId', 'renderer', 'definitionExpression', 'outFields', 'popupTemplate'],
  'subtype-group': ['definitionExpression', 'sublayers', 'outFields', 'labelingInfo', 'labelsVisible', 'popupTemplate', 'gdbVersion']
}

/** No shared Accessor, Collection, renderer, graphic or popup is moved to a comparison copy. */
export function copyValue (value: any): any {
  if (value == null || typeof value !== 'object') return value
  // Collection.clone() is shallow. Copy its members before asking individual Accessors to clone.
  if (typeof value.toArray === 'function') return value.toArray().map(copyValue)
  if (typeof value.clone === 'function') return value.clone()
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(copyValue)
  if (typeof value.toJSON === 'function') return copyValue(value.toJSON())
  if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyValue(item)]))
  }
  // Only primitives/plain data or copyable SDK values are accepted by the property allowlist.
  return undefined
}

/** Layer.clone() is not universal (MapImageLayer has no public clone method).
 * Reconstruct with the SDK constructor and copied sublayers instead of assuming it exists. */
export function createLayerCopier (): (source: any, include?: (source: any) => boolean) => Promise<any> {
  const constructors = new Map<string, Promise<any>>()
  const copy = async (source: any, include?: (source: any) => boolean): Promise<any> => {
    const name = MODULES[source.type]
    if (!name) throw new Error('This layer type cannot be compared in a 2D map.')
    let pending = constructors.get(name)
    if (!pending) {
      pending = loadArcGISJSAPIModules([`esri/layers/${name}`]).then(modules => modules[0])
      constructors.set(name, pending)
    }
    const Constructor = await pending
    const properties: any = { id: source.id, listMode: 'hide', persistenceEnabled: false }
    for (const key of [...COMMON, ...SERVICE, ...(SPECIFIC[source.type] ?? [])]) {
      const value = copyValue(source[key])
      if (value !== undefined) properties[key] = value
    }
    const children: any[] = []
    try {
      if (source.type === 'group') {
        for (const child of asArray(source.layers)) {
          if (MODULES[child.type] && (!include || include(child))) children.push(await copy(child, include))
        }
        properties.layers = children
        properties.visibilityMode = 'independent'
      }
      // A service-backed FeatureLayer's populated `source` is not its constructor data source.
      if (source.type === 'feature' && source.url) delete properties.source
      // currentStyleInfo is read-only. Prefer a style JSON snapshot to a portal-style URL.
      if (source.type === 'vector-tile') {
        delete properties.currentStyleInfo
        if (source.currentStyleInfo?.style) properties.style = copyValue(source.currentStyleInfo.style)
      }
      return new Constructor(properties)
    } catch (error) {
      children.forEach(child => { try { child.destroy?.() } catch {} })
      throw error
    }
  }
  return copy
}
