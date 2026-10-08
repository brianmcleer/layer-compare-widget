/** Pure catalog and selection helpers. No SDK imports, so settings can reuse them safely. */
export const OVERLAY_PREFIX = 'layer-compare__'
const TYPES = new Set([
  'feature', 'map-image', 'group', 'imagery', 'imagery-tile', 'tile', 'vector-tile',
  'web-tile', 'wms', 'wmts', 'geojson', 'csv', 'ogc-feature', 'subtype-group'
])

export interface LayerNode {
  key: string
  title: string
  source: any
  kind: 'layer' | 'sublayer'
  children: LayerNode[]
  /** Only eligible terminal nodes. Parent checkboxes act on these, never hidden siblings. */
  leafKeys: string[]
  listed: boolean
  supported: boolean
  reason?: 'unsupported' | 'loadFailed' | 'noLayers'
}

export interface Selection { start: string[]; end: string[] }

export function asArray<T = any> (collection: any): T[] {
  if (!collection) return []
  if (Array.isArray(collection)) return [...collection]
  if (typeof collection.toArray === 'function') return collection.toArray()
  return Array.from(collection)
}

export function isCompareLayer (layer: any): boolean {
  return String(layer?.id ?? '').startsWith(OVERLAY_PREFIX)
}

export function childrenOf (source: any, kind: 'layer' | 'sublayer' = 'layer'): any[] {
  if (kind === 'sublayer') return asArray(source?.sublayers)
  if (source?.type === 'group') return asArray(source.layers)
  if (source?.type === 'map-image') return asArray(source.sublayers)
  // TileLayer's sublayers are already burned into its tiles. Compare the entire tiled layer.
  // SubtypeGroupLayer is also one endpoint; it has no independently swipable subtype views.
  return []
}

export function buildCatalog (layers: any, scope: string, excluded: readonly string[] = []): LayerNode[] {
  const omissions = new Set(excluded)
  const walk = (source: any, parent: string, kind: 'layer' | 'sublayer', blocked: boolean, ownerSupported: boolean): LayerNode => {
    const key = `${parent}/${kind}:${encodeURIComponent(String(source.id ?? source.uid ?? 'unnamed'))}`
    const listed = !blocked && source.listMode !== 'hide' && !omissions.has(key)
    const supported = ownerSupported && (kind === 'sublayer' || TYPES.has(source.type)) && source.loadStatus !== 'failed'
    const children = childrenOf(source, kind).map(child => walk(
      child, key, kind === 'sublayer' || source.type === 'map-image' ? 'sublayer' : 'layer',
      !listed || source.listMode === 'hide-children', supported
    ))
    const leafKeys = children.length
      ? children.flatMap(child => child.leafKeys)
      : (listed && supported && source.type !== 'group' ? [key] : [])
    return {
      key, title: source.title || String(source.id ?? ''), source, kind, children, leafKeys,
      listed, supported,
      reason: source.loadStatus === 'failed' ? 'loadFailed' : !supported ? 'unsupported' : !leafKeys.length ? 'noLayers' : undefined
    }
  }
  return asArray(layers).filter(layer => !isCompareLayer(layer)).map(layer => walk(layer, encodeURIComponent(scope), 'layer', false, true))
}

export function flattenNodes (tree: LayerNode[]): LayerNode[] {
  return tree.flatMap(node => [node, ...flattenNodes(node.children)])
}

export function listedTree (tree: LayerNode[]): LayerNode[] {
  return tree.filter(node => node.listed).map(node => ({ ...node, children: listedTree(node.children) }))
}

export function filterTree (tree: LayerNode[], query: string): LayerNode[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return tree
  return tree.flatMap(node => {
    if (node.title.toLocaleLowerCase().includes(needle)) return [node]
    const children = filterTree(node.children, query)
    return children.length ? [{ ...node, children }] : []
  })
}

export function normalizeSelection (keys: readonly string[], tree: LayerNode[]): string[] {
  const allowed = new Set(tree.flatMap(node => node.leafKeys))
  return [...new Set(keys)].filter(key => allowed.has(key))
}

export function selectionState (node: LayerNode, keys: readonly string[]): { checked: boolean; partial: boolean } {
  const set = new Set(keys)
  const count = node.leafKeys.filter(key => set.has(key)).length
  return { checked: count > 0 && count === node.leafKeys.length, partial: count > 0 && count < node.leafKeys.length }
}

export function toggleNode (node: LayerNode, keys: readonly string[]): string[] {
  const next = new Set(keys)
  const remove = selectionState(node, keys).checked
  node.leafKeys.forEach(key => { if (remove) next.delete(key); else next.add(key) })
  return [...next]
}

/** Context includes only leaves visible at the start, with both side selections removed. */
export function visibleLeafKeys (node: LayerNode, rootVisible: boolean): string[] {
  const walk = (item: LayerNode, visible: boolean, root: boolean): string[] => {
    const on = visible && (root ? rootVisible : item.source.visible !== false)
    if (!on) return []
    return item.children.length ? item.children.flatMap(child => walk(child, on, false)) : [item.key]
  }
  return walk(node, true, true)
}

/** Apply a terminal-node mask to COPIES only. Numeric MapServer sublayer ids never change. */
export function applyMask (node: LayerNode, copy: any, keys: ReadonlySet<string>): boolean {
  if (node.children.length) {
    const children = childrenOf(copy, node.kind)
    let visible = false
    for (const child of node.children) {
      const match = children.find(candidate => String(candidate.id) === String(child.source.id))
      if (match) visible = applyMask(child, match, keys) || visible
    }
    if (copy.type === 'group') copy.visibilityMode = 'independent'
    copy.visible = visible
    return visible
  }
  copy.visible = keys.has(node.key)
  return copy.visible
}

/** Groups are retained for ordering/opacity, but Swipe receives the actual rendering layers. */
export function renderingLayers (copy: any): any[] {
  if (copy.type === 'group') return asArray(copy.layers).flatMap(renderingLayers)
  return copy.visible ? [copy] : []
}

export function outsideScale (node: LayerNode, scale: number): boolean {
  if (!scale) return false
  const min = Number(node.source.minScale) || 0
  const max = Number(node.source.maxScale) || 0
  return (min > 0 && scale > min) || (max > 0 && scale < max)
}

export async function withTimeout<T> (promise: Promise<T>, milliseconds = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([promise, new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Layer Compare timed out waiting for the map.')), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}
