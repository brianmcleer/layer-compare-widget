import type { CompareDirection } from '../config'
import { clampPosition } from '../config'
import { applyMask, asArray, childrenOf, isCompareLayer, renderingLayers, visibleLeafKeys, withTimeout } from './layer-model'
import type { LayerNode, Selection } from './layer-model'

export interface SwipeOptions {
  direction: CompareDirection
  position: number
  startLabel: string
  endLabel: string
}
export interface SwipeHandle {
  setLayers: (start: any[], end: any[]) => void
  setOptions: (options: SwipeOptions) => void
  destroy: () => void
}
export interface SessionAdapters {
  copyLayer: (source: any, include?: (source: any) => boolean) => Promise<any>
  createSwipe: (view: any, onMove: (position: number) => void, start: any[], end: any[], options: SwipeOptions) => Promise<SwipeHandle>
}
interface OwnedCopy {
  layer: any
  root: LayerNode
  side: 'start' | 'end'
  maskKey: string
  renderers: any[]
  sourcePairs: Array<{ node: LayerNode; copy: any }>
}
/** Load renderable copies without fetching every hidden MapServer sublayer and table. */
async function loadCopy (layer: any): Promise<void> {
  await withTimeout(Promise.resolve(layer.load?.() ?? layer.loadAll?.()))
  if (layer.type === 'group') await Promise.all(asArray(layer.layers).map(loadCopy))
}
const OWNERS = new WeakMap<object, CompareSession>()
let nextBatch = 0

/** Owns only temporary copies and the top-level visibility values it temporarily changes. */
export class CompareSession {
  private epoch = 0
  private snapshots = new Map<any, boolean>()
  private copies: OwnedCopy[] = []
  private pending = new Set<any>()
  private swipe?: SwipeHandle
  private options?: SwipeOptions
  private busy = false
  private disposed = false
  readonly view: any
  private readonly adapters: SessionAdapters
  private readonly widgetId: string
  private readonly onMove: (position: number) => void

  constructor (view: any, widgetId: string, adapters: SessionAdapters, onMove: (position: number) => void) {
    this.view = view
    this.widgetId = widgetId
    this.adapters = adapters
    this.onMove = onMove
  }

  get active (): boolean { return !!this.swipe && this.copies.length > 0 }
  get preparing (): boolean { return this.busy }
  get engaged (): boolean { return this.active || this.busy }

  setOptions (options: SwipeOptions): void {
    this.options = { ...options, position: clampPosition(options.position) }
    this.swipe?.setOptions(this.options)
  }

  async apply (tree: LayerNode[], selection: Selection, keepOtherLayers: boolean, options: SwipeOptions): Promise<boolean> {
    if (this.disposed) return false
    const map = this.view.map
    if (this.view.type !== '2d') throw new Error('Layer Compare requires a 2D map.')
    const owner = OWNERS.get(map)
    if (owner && owner !== this) throw new Error('Another Layer Compare is already using this map. Stop that comparison first.')
    if (!selection.start.length && !selection.end.length) { this.stop(); return false }
    OWNERS.set(map, this)
    if (!this.snapshots.size) {
      asArray(map.layers).filter(layer => !isCompareLayer(layer)).forEach(layer => this.snapshots.set(layer, layer.visible !== false))
    }
    const token = ++this.epoch
    const batch = ++nextBatch
    this.busy = true
    this.setOptions(options)
    const selectedStart = new Set(selection.start)
    const selectedEnd = new Set(selection.end)
    const selectedBoth = new Set([...selectedStart, ...selectedEnd])
    const stage: OwnedCopy[] = []
    const created = new Set<any>()
    const reused = new Set<any>()
    let newSwipe: SwipeHandle | undefined
    const current = (): boolean => token === this.epoch && !this.disposed && !this.view.destroyed
    const cleanupStage = (): void => { created.forEach(layer => this.removeCopy(layer)) }
    const jobs: Array<() => Promise<OwnedCopy>> = []
    const jobSides: Array<OwnedCopy['side']> = []
    const prepare = async (root: LayerNode, mask: Set<string>, side: OwnedCopy['side'], slot: number): Promise<OwnedCopy> => {
      const needed = new Set<any>()
      const markNeeded = (node: LayerNode): boolean => {
        const on = node.children.length
          ? node.children.map(markNeeded).some(Boolean)
          : mask.has(node.key) && node.supported
        if (on) needed.add(node.source)
        return on
      }
      if (!markNeeded(root)) throw new Error('The selected layers could not be prepared.')
      const copy = await this.adapters.copyLayer(root.source, source => needed.has(source))
      created.add(copy)
      this.pending.add(copy)
      const item: OwnedCopy = { layer: copy, root, side, maskKey: JSON.stringify([...mask].sort()), renderers: [], sourcePairs: [] }
      if (!current()) { this.removeCopy(copy); return item }
      await loadCopy(copy)
      if (!current()) return item
      applyMask(root, copy, mask)
      item.renderers = renderingLayers(copy)
      const matchSources = (node: LayerNode, clone: any): void => {
        if (node.kind === 'layer' && node.source.type !== 'group') item.sourcePairs.push({ node, copy: clone })
        const children = childrenOf(clone, node.kind)
        for (const child of node.children) {
          const match = children.find(candidate => String(candidate.id) === String(child.source.id))
          if (match) matchSources(child, match)
        }
      }
      matchSources(root, copy)
      // Assign unique ids to actual layers AFTER matching the source ids in applyMask.
      // Sublayer ids are service identifiers and stay unchanged.
      let ordinal = 0
      const hideInLists = (layer: any): void => {
        layer.id = `layer-compare__${encodeURIComponent(this.widgetId)}__${batch}__${side}__${slot}__${ordinal++}`
        layer.listMode = 'hide'
        if ('persistenceEnabled' in layer) layer.persistenceEnabled = false
        if (layer.type === 'group') asArray(layer.layers).forEach(hideInLists)
      }
      hideInLists(copy)
      copy.visible = false
      return item
    }
    try {
      for (const root of tree) {
        if (!current()) { cleanupStage(); return false }
        const start = new Set(root.leafKeys.filter(key => selectedStart.has(key)))
        const end = new Set(root.leafKeys.filter(key => selectedEnd.has(key)))
        if (keepOtherLayers && (start.size || end.size)) {
          const context = visibleLeafKeys(root, this.snapshots.get(root.source) ?? false).filter(key => !selectedBoth.has(key))
          context.forEach(key => { start.add(key); end.add(key) })
        }
        for (const [mask, side] of [[start, 'start'], [end, 'end']] as const) {
          if (!mask.size) continue
          const maskKey = JSON.stringify([...mask].sort())
          const existing = this.copies.find(item => item.root.source === root.source && item.maskKey === maskKey &&
            !item.layer.destroyed && !reused.has(item.layer))
          const slot = jobs.length
          jobSides.push(side)
          if (existing) {
            reused.add(existing.layer)
            jobs.push(async () => ({ ...existing, root, side }))
          } else jobs.push(() => prepare(root, mask, side, slot))
        }
      }
      // Start both sides together, with bounded concurrency and deterministic drawing order.
      const bySide = { start: [] as number[], end: [] as number[] }
      jobSides.forEach((side, index) => bySide[side].push(index))
      const queue: number[] = []
      for (let index = 0; index < Math.max(bySide.start.length, bySide.end.length); index++) {
        if (index < bySide.start.length) queue.push(bySide.start[index])
        if (index < bySide.end.length) queue.push(bySide.end[index])
      }
      let next = 0
      let preparationFailed = false
      const prepared: OwnedCopy[] = new Array(jobs.length)
      const workers = Array.from({ length: Math.min(4, jobs.length) }, async () => {
        while (current() && !preparationFailed && next < jobs.length) {
          const index = queue[next++]
          try { prepared[index] = await jobs[index]() } catch (error) { preparationFailed = true; throw error }
        }
      })
      const results = await Promise.allSettled(workers)
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failed) throw failed.reason
      stage.push(...prepared.filter(Boolean))
      if (!current()) { cleanupStage(); return false }
      if (!stage.some(item => item.renderers.length)) throw new Error('The selected layers could not be prepared.')
      const additions = stage.filter(item => created.has(item.layer)).map(item => item.layer)
      if (additions.length) map.addMany(additions)
      // Await real layer-view creation before hiding anything on the original map.
      await withTimeout(Promise.all(stage.flatMap(item => item.renderers).map(layer => this.view.whenLayerView(layer))))
      if (!current()) { cleanupStage(); return false }
      // Preserve existing view filters/feature effects in addition to copied layer definitions.
      for (const item of stage) {
        if (!created.has(item.layer)) continue
        await this.copyViewFilters(item)
        if (!current()) { cleanupStage(); return false }
      }
      const startLayers = stage.filter(item => item.side === 'start').flatMap(item => item.renderers)
      const endLayers = stage.filter(item => item.side === 'end').flatMap(item => item.renderers)
      if (!this.swipe) {
        newSwipe = await this.adapters.createSwipe(this.view, this.onMove, startLayers, endLayers, this.options!)
        if (!current()) { newSwipe.destroy(); cleanupStage(); return false }
      }
      const swipe = this.swipe ?? newSwipe!
      swipe.setLayers(startLayers, endLayers)
      swipe.setOptions(this.options!)
      const selectedOwners = new Set(tree.filter(root => root.leafKeys.some(key => selectedBoth.has(key))).map(root => root.source))
      for (const [source, visible] of this.snapshots) {
        if (!source.destroyed) source.visible = keepOtherLayers && !selectedOwners.has(source) ? visible : false
      }
      // Interleave copies in original drawing order, including shared context within a service.
      for (const root of tree) {
        for (const item of stage.filter(item => item.root === root)) {
          item.layer.visible = true
          const layers = asArray(map.layers)
          const index = Math.max(0, layers.indexOf(root.source) + 1)
          if (layers.indexOf(item.layer) !== index) map.reorder?.(item.layer, index)
        }
      }
      if (!current()) { newSwipe?.destroy(); cleanupStage(); return false }
      const previous = this.copies
      this.swipe = swipe
      newSwipe = undefined
      this.copies = stage
      stage.forEach(item => this.pending.delete(item.layer))
      const retained = new Set(stage.map(item => item.layer))
      previous.filter(item => !retained.has(item.layer)).forEach(item => this.removeCopy(item.layer))
      return true
    } catch (error) {
      newSwipe?.destroy()
      cleanupStage()
      if (!current()) return false
      this.stop()
      throw error
    } finally {
      if (token === this.epoch) this.busy = false
    }
  }

  private async copyViewFilters (item: OwnedCopy): Promise<void> {
    for (const { node, copy } of item.sourcePairs) {
      if (!item.renderers.includes(copy) || !['feature', 'geojson', 'csv', 'ogc-feature'].includes(node.source.type)) continue
      const [sourceView, copyView] = await withTimeout(Promise.all([
        this.view.whenLayerView(node.source), this.view.whenLayerView(copy)
      ]))
      if (sourceView.filter && 'filter' in copyView) copyView.filter = sourceView.filter.clone?.() ?? sourceView.filter
      if (sourceView.featureEffect && 'featureEffect' in copyView) copyView.featureEffect = sourceView.featureEffect.clone?.() ?? sourceView.featureEffect
    }
  }

  private removeCopy (layer: any): void {
    this.pending.delete(layer)
    try { this.view.map.remove(layer) } catch {}
    try { layer.destroy?.() } catch {}
  }

  stop (): void {
    ++this.epoch
    this.busy = false
    this.swipe?.destroy()
    this.swipe = undefined
    this.copies.forEach(item => this.removeCopy(item.layer))
    this.copies = []
    Array.from(this.pending).forEach(layer => this.removeCopy(layer))
    for (const [source, visible] of this.snapshots) {
      try { if (!source.destroyed) source.visible = visible } catch {}
    }
    this.snapshots.clear()
    if (OWNERS.get(this.view.map) === this) OWNERS.delete(this.view.map)
  }

  dispose (): void { this.stop(); this.disposed = true }
}
