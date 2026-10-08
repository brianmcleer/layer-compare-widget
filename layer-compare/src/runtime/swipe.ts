import Collection from 'esri/core/Collection'
import { clampPosition } from '../config'
import { withTimeout } from './layer-model'
import type { SwipeHandle, SwipeOptions } from './compare-session'

const POINTER_CSS = ':host{pointer-events:none!important}' +
  '.esri-swipe__container{pointer-events:none!important}' +
  '.esri-swipe__divider,.esri-swipe__handle,.esri-swipe__handle-inner{pointer-events:auto!important}' +
  '.root{pointer-events:none!important}.container,.divider,.handle{pointer-events:auto!important}'

/** Preserve native map pan/zoom around the divider. Copied from the Basemap Gallery fix. */
function passMapEvents (element: any): void {
  element.style.pointerEvents = 'none'
  element.style.position = 'absolute'
  element.style.inset = '0'
  const root = element.shadowRoot
  if (!root || element.__layerComparePointerSheet) return
  try {
    if (typeof CSSStyleSheet !== 'undefined' && Array.isArray(root.adoptedStyleSheets)) {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(POINTER_CSS)
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    } else {
      const style = document.createElement('style')
      style.textContent = POINTER_CSS
      root.appendChild(style)
    }
    element.__layerComparePointerSheet = true
  } catch {
    const style = document.createElement('style')
    style.textContent = POINTER_CSS
    root.appendChild(style)
    element.__layerComparePointerSheet = true
  }
}

export async function createSwipe (
  view: any, onMove: (position: number) => void, start: any[], end: any[], initial: SwipeOptions
): Promise<SwipeHandle> {
  await withTimeout(customElements.whenDefined('arcgis-swipe'), 15000)
  const element: any = document.createElement('arcgis-swipe')
  element.autoDestroyDisabled = true
  let removed = false

  const setLayers = (leading: any[], trailing: any[]): void => {
    if ('startLayers' in element) element.startLayers = new Collection(leading)
    else element.leadingLayers = new Collection(leading)
    if ('endLayers' in element) element.endLayers = new Collection(trailing)
    else element.trailingLayers = new Collection(trailing)
  }
  const setOptions = (next: SwipeOptions): void => {
    element.direction = next.direction
    element.label = `${next.startLabel} / ${next.endLabel}`
    if ('position' in element) element.position = clampPosition(next.position)
    else element.swipePosition = clampPosition(next.position)
  }
  const onInput = (): void => {
    onMove(clampPosition('position' in element ? element.position : element.swipePosition))
  }
  const onReady = (): void => { passMapEvents(element) }
  const destroy = (): void => {
    if (removed) return
    removed = true
    element.removeEventListener('arcgisSwipeInput', onInput)
    element.removeEventListener('arcgisSwipeChange', onInput)
    element.removeEventListener('arcgisReady', onReady)
    try { setLayers([], []) } catch {}
    try { element.view = null } catch {}
    try { view.ui.remove(element) } catch {}
    try { element.remove() } catch {}
    try { Promise.resolve(element.destroy?.()).catch(() => {}) } catch {}
  }
  try {
    element.addEventListener('arcgisSwipeInput', onInput)
    element.addEventListener('arcgisSwipeChange', onInput)
    element.addEventListener('arcgisReady', onReady)
    setLayers(start, end)
    setOptions(initial)
    passMapEvents(element)
    element.view = view
    view.ui.add(element, 'manual')
    passMapEvents(element)
    if (typeof element.componentOnReady === 'function') await withTimeout(element.componentOnReady(), 15000)
    passMapEvents(element)
    return { setLayers, setOptions, destroy }
  } catch (error) { destroy(); throw error }
}
