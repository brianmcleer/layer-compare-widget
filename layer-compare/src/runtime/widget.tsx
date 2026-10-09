import { React, css, WidgetState, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { Button, TextInput, Select, Option, Switch } from 'jimu-ui'
import { CalciteIcon, CalciteSlider } from 'calcite-components'
import 'arcgis-map-components'
import * as reactiveUtils from 'esri/core/reactiveUtils'
import type { IMConfig, CompareDirection } from '../config'
import { clampPosition } from '../config'
import { translate } from '../i18n'
import { asArray, buildCatalog, flattenNodes, isCompareLayer, normalizeSelection, toggleNode, withTimeout } from './layer-model'
import type { LayerNode, Selection } from './layer-model'
import { CompareSession, type SwipeOptions } from './compare-session'
import { createLayerCopier } from './layer-copy'
import { createSwipe } from './swipe'
import LayerPicker from './components/LayerPicker'
import HelpPopup from './components/HelpPopup'
import FirstRunHint from './components/FirstRunHint'
import { useTokens } from './theme'
import { buildHelpSections } from './helpSections'
import { dismissHelpHint, isHelpHintDismissed } from './helpHint'
import messages from './translations/default'
import { beacon, type BeaconHandle } from '../shared/beacon'
import { __setIntl } from './i18n-t'

type Props = AllWidgetProps<IMConfig> & { id: string; useMapWidgetIds?: string[] }
const { useEffect, useState, useRef, useCallback } = React

export default function Widget (props: Props): React.ReactElement {
  __setIntl((props as any).intl)
  const tokens = useTokens()
  const t = useCallback((id: string, values?: Record<string, any>) => translate(props.intl, messages, id, values), [props.intl])
  const [jimuMapView, setJimuMapView] = useState<JimuMapView>(null)
  const [tree, setTree] = useState<LayerNode[]>([])
  const [selection, setSelection] = useState<Selection>({ start: [], end: [] })
  const [query, setQuery] = useState('')
  const [direction, setDirection] = useState<CompareDirection>(props.config?.direction === 'vertical' ? 'vertical' : 'horizontal')
  const [position, setPosition] = useState(clampPosition(props.config?.initialPosition ?? 50))
  const [keepOthers, setKeepOthers] = useState(props.config?.keepOtherLayers === true)
  const [requested, setRequested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [scale, setScale] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [showHint, setShowHint] = useState(() => !isHelpHintDismissed(props.id))
  const session = useRef<CompareSession>(null)
  const activeMap = useRef<{ view: JimuMapView; widgetId?: string }>({ view: null })
  const telemetry = useRef<BeaconHandle>(null)
  const defaultsApplied = useRef('')
  const config = props.config
  const mapId = props.useMapWidgetIds?.[0]
  const scope = jimuMapView?.dataSourceId || jimuMapView?.id || ''
  const closed = props.state === WidgetState.Closed || props.state === 'CLOSED'
  const scene = !!jimuMapView?.view && jimuMapView.view.type !== '2d'
  const showHelp = config?.showHelp !== false
  const contextToggle = config?.allowContextToggle !== false
  const excludedKey = JSON.stringify(config?.excludedLayerKeys ?? [])
  const defaultKey = JSON.stringify([config?.defaultStartKeys ?? [], config?.defaultEndKeys ?? []])
  const selectionKey = JSON.stringify(selection)
  const startLabel = config?.startLabel?.trim() || t(direction === 'horizontal' ? 'left' : 'top')
  const endLabel = config?.endLabel?.trim() || t(direction === 'horizontal' ? 'right' : 'bottom')
  const options: SwipeOptions = { direction, position, startLabel, endLabel }
  const optionsRef = useRef(options)
  optionsRef.current = options
  const available = tree.some(root => root.leafKeys.length > 0)
  const hasSelection = selection.start.length + selection.end.length > 0

  useEffect(() => { telemetry.current = beacon.init(props) }, [config?.telemetry])
  useEffect(() => { setShowHint(!isHelpHintDismissed(props.id)) }, [props.id])
  useEffect(() => {
    setDirection(config?.direction === 'vertical' ? 'vertical' : 'horizontal')
    setPosition(clampPosition(config?.initialPosition ?? 50))
    setKeepOthers(config?.keepOtherLayers === true)
  }, [config?.direction, config?.initialPosition, config?.keepOtherLayers])

  const stop = useCallback((message?: string) => {
    session.current?.stop()
    setRequested(false)
    setBusy(false)
    if (message) setStatus(message)
  }, [])
  const activeViewChange = useCallback((view: JimuMapView) => {
    const previous = activeMap.current
    if (previous.widgetId === mapId && previous.view?.view === view?.view &&
      (previous.view?.dataSourceId || previous.view?.id) === (view?.dataSourceId || view?.id)) return
    activeMap.current = { view, widgetId: mapId }
    session.current?.dispose()
    session.current = null
    setRequested(false)
    setBusy(false)
    setTree([])
    setSelection({ start: [], end: [] })
    defaultsApplied.current = ''
    setJimuMapView(view)
    setError('')
  }, [mapId])

  useEffect(() => {
    if (!jimuMapView?.view || scene) return
    const current = new CompareSession(jimuMapView.view, props.id, { copyLayer: createLayerCopier(), createSwipe }, setPosition)
    session.current = current
    return () => { current.dispose(); if (session.current === current) session.current = null }
  }, [jimuMapView, props.id, scene])

  useEffect(() => { if (closed) stop(); }, [closed, stop])
  useEffect(() => { if (!mapId) { stop(); setTree([]) } }, [mapId, stop])

  useEffect(() => {
    const view = jimuMapView?.view
    if (!view || scene) { setCatalogBusy(false); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const handles: Array<{ remove: () => void }> = []
    const readSourceOrder = (): any[] => flattenNodes(buildCatalog(view.map.layers, scope)).map(node => node.source)
    let sourceOrder = readSourceOrder()
    setCatalogBusy(true)
    const load = async (): Promise<void> => {
      try {
        await withTimeout(view.when())
        const roots = asArray(view.map.layers).filter(layer => !isCompareLayer(layer))
        await Promise.allSettled(roots.map(layer => withTimeout(Promise.resolve(layer.loadAll?.() ?? layer.load?.()))))
        if (cancelled) return
        const catalog = buildCatalog(view.map.layers, scope, JSON.parse(excludedKey))
        sourceOrder = readSourceOrder()
        setTree(catalog)
        setError('')
        // MapServer sublayer collection changes do not propagate into map.allLayers.
        flattenNodes(catalog).forEach(node => {
          const collection = node.source.type === 'group' ? node.source.layers : node.source.sublayers
          if (collection?.on) handles.push(collection.on('change', changed))
        })
      } catch (failure) {
        if (!cancelled) { telemetry.current?.error(failure, 'read-layers'); setError(t('mapLoadError')) }
      } finally { if (!cancelled) setCatalogBusy(false) }
    }
    const changed = (): void => {
      // CollectionFlattener reports source index shifts when our overlays are removed.
      // Compare actual source order after filtering copies, rather than its moved array.
      const next = readSourceOrder()
      if (next.length === sourceOrder.length && next.every((source, index) => source === sourceOrder[index])) return
      sourceOrder = next
      if (session.current?.engaged) stop(t('changedMap'))
      clearTimeout(timer)
      timer = setTimeout(() => { if (!cancelled) setRefresh(value => value + 1) }, 400)
    }
    if (view.map.allLayers?.on) handles.push(view.map.allLayers.on('change', changed))
    handles.push(reactiveUtils.watch(() => view.scale, value => setScale(Number(value) || 0), { initial: true }))
    void load()
    return () => { cancelled = true; clearTimeout(timer); handles.forEach(handle => handle.remove()) }
  }, [jimuMapView, scope, excludedKey, refresh, scene, t, stop])

  useEffect(() => {
    if (catalogBusy || !tree.length) return
    const signature = `${scope}:${defaultKey}`
    if (defaultsApplied.current !== signature) {
      defaultsApplied.current = signature
      setSelection({
        start: normalizeSelection(JSON.parse(defaultKey)[0], tree),
        end: normalizeSelection(JSON.parse(defaultKey)[1], tree)
      })
    } else {
      setSelection(previous => {
        const next = { start: normalizeSelection(previous.start, tree), end: normalizeSelection(previous.end, tree) }
        return JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      })
    }
  }, [tree, catalogBusy, scope, defaultKey])

  useEffect(() => {
    // Moving the divider, changing direction, or changing a label never reloads map layers.
    session.current?.setOptions(options)
  }, [direction, position, startLabel, endLabel])

  useEffect(() => {
    if (!requested || closed) return
    const current = session.current
    if (!current || !hasSelection) { stop(t('selectFirst')); return }
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      setBusy(true)
      setError('')
      setStatus(t('preparing'))
      void current.apply(tree, selection, contextToggle ? keepOthers : config?.keepOtherLayers === true, optionsRef.current).then(applied => {
        if (cancelled) return
        setBusy(false)
        if (applied) setStatus(t('active'))
      }).catch(failure => {
        if (cancelled) return
        telemetry.current?.error(failure, 'compare')
        stop()
        const message = String(failure?.message ?? '').includes('Another Layer Compare') ? t('anotherCompare') : t('compareFailed')
        setError(message)
        setStatus(message)
      })
    }, 100)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [requested, closed, tree, selectionKey, keepOthers, contextToggle, config?.keepOtherLayers, stop, t])

  const toggleLayer = (node: LayerNode, side: 'start' | 'end'): void => {
    setSelection(previous => ({ ...previous, [side]: toggleNode(node, previous[side]) }))
  }
  const toggleCompare = (): void => {
    if (requested) { telemetry.current?.action('stop'); stop(t('stopped')) }
    else if (hasSelection) { telemetry.current?.action('compare'); setError(''); setRequested(true) }
    else setStatus(t('selectFirst'))
  }
  const reset = (): void => {
    telemetry.current?.action('reset')
    stop(t('resetDone'))
    setSelection({ start: normalizeSelection(config?.defaultStartKeys ?? [], tree), end: normalizeSelection(config?.defaultEndKeys ?? [], tree) })
    setPosition(clampPosition(config?.initialPosition ?? 50))
    setDirection(config?.direction === 'vertical' ? 'vertical' : 'horizontal')
    setKeepOthers(config?.keepOtherLayers === true)
    setQuery(''); setError('')
  }
  const dismissHint = (): void => { dismissHelpHint(props.id); setShowHint(false) }
  const openHelp = (): void => { dismissHint(); setHelpOpen(true) }
  const sliderInput = (event: any): void => { setPosition(clampPosition(event.target.value)) }
  const style = css`
    height: 100%; min-height: 0; display: flex; flex-direction: column; background: ${tokens.surface}; color: ${tokens.text}; font-size: 13px;
    --calcite-color-brand: ${tokens.primary}; --calcite-color-text-1: ${tokens.text};
    --calcite-color-foreground-1: ${tokens.surface};
    .lc-intro { padding: 12px 14px 10px; display: flex; align-items: flex-start; gap: 8px; }
    .lc-controls { padding: 0 14px 12px; border-bottom: 1px solid ${tokens.divider}; }
    .lc-description { margin: 0; flex: 1; min-width: 0; line-height: 1.5; color: ${tokens.textSecondary}; }
    .lc-toolbar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .lc-direction { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .lc-direction label { margin: 0; flex: 1; }
    .lc-slider { margin-top: 8px; }
    .lc-slider-line { display: flex; align-items: center; gap: 8px; }
    .lc-slider-line calcite-slider { min-width: 0; flex: 1; }
    .lc-counts { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 6px; margin-top: 8px; }
    .lc-counts div { border: 1px solid ${tokens.divider}; border-radius: ${tokens.radius}; padding: 6px 8px; overflow-wrap: anywhere; }
    .lc-context { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0 0; line-height: 1.4; }
    .lc-scroll { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding-bottom: 12px; }
    .lc-search { padding: 12px 14px 8px; }
    .lc-note { margin: 8px 14px; padding: 10px 12px; border: 1px solid ${tokens.divider}; border-radius: ${tokens.radius}; background: ${tokens.infoBg}; color: ${tokens.text}; line-height: 1.5; }
    .lc-error { border-left: 3px solid ${tokens.danger}; }
    .lc-foot { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-top: 1px solid ${tokens.divider}; font-size: 12px; color: ${tokens.textSecondary}; }
    button:focus-visible { outline: 2px solid ${tokens.primary}; outline-offset: 2px; }
    .lc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  `
  return <div className='widget-layer-compare jimu-widget' css={style}>
    {mapId && <JimuMapViewComponent useMapWidgetId={mapId} onActiveViewChange={activeViewChange} />}
    <div className='lc-intro'><p className='lc-description'>{t('description')}</p>
      {showHelp && <Button size='sm' type='tertiary' icon onClick={openHelp} title={t('helpTitle')} aria-label={t('helpTitle')} style={{ flexShrink: 0 }}><CalciteIcon icon='question' scale='s' /></Button>}
    </div>
    <FirstRunHint showFirstRunHint={showHelp && showHint} t={t} onOpenHelp={openHelp} onDismissHint={dismissHint} />
    {mapId && !scene && <div className='lc-controls'>
      <div className='lc-toolbar' role='toolbar' aria-label={t('title')}>
        <Button type={requested ? 'secondary' : 'primary'} size='sm' onClick={toggleCompare}
          disabled={!requested && (closed || catalogBusy || !available || !hasSelection)} aria-pressed={requested}>
          <CalciteIcon icon={requested ? 'stop' : 'play'} scale='s' /> {t(requested ? 'stop' : 'start')}
        </Button>
        <Button size='sm' onClick={() => {
          telemetry.current?.action('swap'); setSelection(previous => ({ start: previous.end, end: previous.start })); setStatus(t('swapped'))
        }} disabled={busy || !hasSelection}>{t('swap')}</Button>
        <Button size='sm' onClick={reset}>{t('reset')}</Button>
      </div>
      <div className='lc-direction'><label htmlFor={`${props.id}-direction`}>{t('direction')}</label>
        <Select id={`${props.id}-direction`} size='sm' value={direction} aria-label={t('direction')}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setDirection(event.target.value as CompareDirection)} style={{ width: 'auto', maxWidth: '100%' }}>
          <Option value='horizontal'>{t('leftRight')}</Option><Option value='vertical'>{t('topBottom')}</Option>
        </Select>
      </div>
      <div className='lc-slider'><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>{t('dividerPosition')}</span>
        <Button type='tertiary' size='sm' onClick={() => setPosition(50)}>{t('resetPosition')}</Button>
      </div><div className='lc-slider-line'><CalciteSlider min={0} max={100} step={1} value={position} scale='s' labelHandles
        label={t('sliderLabel', { position })} onCalciteSliderInput={sliderInput} onCalciteSliderChange={sliderInput} />
        <span style={{ minWidth: '35px', textAlign: 'right' }}>{position}%</span></div>
      </div>
      <div className='lc-counts'>{(['start', 'end'] as const).map(side => {
        const label = side === 'start' ? startLabel : endLabel
        return <div key={side}><strong>{label}: <span data-side={side}>{selection[side].length}</span> {t('layerCompareSelected')}</strong>
          {!selection[side].length && <span style={{ display: 'block', color: tokens.textSecondary }}>{t(keepOthers ? 'sharedLayers' : 'basemapOnly')}</span>}
          <Button size='sm' type='tertiary' onClick={() => {
            setSelection(previous => ({ ...previous, [side]: [] })); setStatus(t('cleared', { side: label }))
          }} disabled={busy || !selection[side].length}>{t('clearSide', { side: label })}</Button>
        </div>
      })}</div>
      {contextToggle && <label className='lc-context' htmlFor={`${props.id}-context`} title={t('keepOthersHint')}>
        <Switch id={`${props.id}-context`} checked={keepOthers} disabled={busy} aria-label={t('keepOthers')}
          onChange={() => setKeepOthers(previous => !previous)} /><span>{t('keepOthers')}</span>
      </label>}
    </div>}
    <div className='lc-scroll' aria-busy={catalogBusy || busy}>
      {!mapId && <p className='lc-note'>{t('connectMap')}</p>}
      {scene && <p className='lc-note'>{t('sceneNotSupported')}</p>}
      {error && <p className='lc-note lc-error'>{error}</p>}
      {mapId && !scene && <>
        <div className='lc-search'><TextInput size='sm' allowClear value={query} placeholder={t('filterLayers')} aria-label={t('filterLayers')}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: tokens.textSecondary, lineHeight: 1.5 }}>{t('selectionHint')}</p>
        </div>
        {catalogBusy ? <p className='lc-note'>{t('mapLoading')}</p> : <LayerPicker id={props.id} scope={scope} tree={tree} query={query}
          selection={selection} startLabel={startLabel} endLabel={endLabel} disabled={busy} scale={scale} t={t} onToggle={toggleLayer} />}
      </>}
    </div>
    {mapId && <footer className='lc-foot'><span style={{ flex: 1 }}>{busy ? t('preparing') : requested ? t('active') : t('selectFirst')}</span>
      <Button type='tertiary' size='sm' icon disabled={busy || catalogBusy} onClick={() => { setRefresh(value => value + 1) }}
        title={t('refreshLayers')} aria-label={t('refreshLayers')}><CalciteIcon icon='refresh' scale='s' /></Button>
    </footer>}
    <div className='lc-sr' role='status' aria-live='polite' aria-atomic='true'>{status || (catalogBusy ? t('mapLoading') : '')}</div>
    {showHelp && <HelpPopup open={helpOpen} onClose={() => setHelpOpen(false)} sections={buildHelpSections(t, { contextToggle })}
      title={t('helpTitle')} intro={t('helpIntro')} searchPlaceholder={t('helpSearchPlaceholder')} noMatches={t('helpNoMatches')} closeLabel={t('close')} />}
  </div>
}
