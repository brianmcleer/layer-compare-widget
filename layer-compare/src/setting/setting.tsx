import { React, css } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { Button, NumericInput, Select, Option, Switch, TextInput } from 'jimu-ui'
import { CalciteIcon } from 'calcite-components'
import type { Config, IMConfig } from '../config'
import { clampPosition } from '../config'
import { translate } from '../i18n'
import { asArray, buildCatalog, isCompareLayer, normalizeSelection, toggleNode, withTimeout } from '../runtime/layer-model'
import type { LayerNode } from '../runtime/layer-model'
import LayerPicker from '../runtime/components/LayerPicker'
import { useTokens } from '../runtime/theme'
import messages from './translations/default'

// Structural props keep the copied mode-B editor shim isolated from jimu-for-builder types.
interface Props {
  id: string
  config: IMConfig
  useMapWidgetIds?: readonly string[]
  intl?: any
  onSettingChange: (settings: any) => void
  [key: string]: any
}

export default function Setting (props: Props): React.ReactElement {
  const tokens = useTokens()
  const t = (id: string, values?: Record<string, any>): string => translate(props.intl, messages, id, values)
  const [mapView, setMapView] = React.useState<JimuMapView>(null)
  const [catalog, setCatalog] = React.useState<LayerNode[]>([])
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [refresh, setRefresh] = React.useState(0)
  const scope = mapView?.dataSourceId || mapView?.id || ''
  const config = props.config
  const direction = config?.direction === 'vertical' ? 'vertical' : 'horizontal'
  const startLabel = config?.startLabel?.trim() || t(direction === 'horizontal' ? 'left' : 'top')
  const endLabel = config?.endLabel?.trim() || t(direction === 'horizontal' ? 'right' : 'bottom')
  const excluded = config?.excludedLayerKeys ?? []
  const available = buildCatalog(catalog.map(node => node.source), scope, excluded)
  const allKeys = catalog.flatMap(node => node.leafKeys)
  const included = allKeys.filter(key => !excluded.includes(key))
  const defaults = {
    start: normalizeSelection(config?.defaultStartKeys ?? [], available),
    end: normalizeSelection(config?.defaultEndKeys ?? [], available)
  }
  const update = (key: keyof Config, value: any): void => {
    props.onSettingChange({ id: props.id, config: config.set(key, value) })
  }
  React.useEffect(() => {
    let cancelled = false
    if (!mapView?.view || mapView.view.type !== '2d') { setCatalog([]); setLoading(false); return }
    setLoading(true)
    void (async () => {
      try {
        await withTimeout(mapView.view.when())
        const roots = asArray(mapView.view.map.layers).filter(layer => !isCompareLayer(layer))
        await Promise.allSettled(roots.map(layer => withTimeout(Promise.resolve(layer.loadAll?.() ?? layer.load?.()))))
        if (!cancelled) { setCatalog(buildCatalog(mapView.view.map.layers, scope)); setError('') }
      } catch {
        if (!cancelled) setError(messages.settingLoadError)
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [mapView, scope, refresh])

  const toggler = (key: keyof Config, checked: boolean, label: string): React.ReactNode => <SettingRow>
    <label htmlFor={`${props.id}-setting-${key}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', margin: 0, lineHeight: 1.5 }}>
      <Switch id={`${props.id}-setting-${key}`} checked={checked} aria-label={label} onChange={() => update(key, !checked)} />
      <span>{label}</span>
    </label>
  </SettingRow>
  const style = css`
    color: ${tokens.text}; background: ${tokens.surface};
    .lc-setting-note { font-size: 12px; color: ${tokens.textSecondary}; line-height: 1.5; margin: 4px 0 8px; }
    .lc-setting-tree { max-height: 340px; overflow-y: auto; overflow-x: hidden; border: 1px solid ${tokens.divider}; border-radius: ${tokens.radius}; margin-top: 8px; }
    button:focus-visible { outline: 2px solid ${tokens.primary}; outline-offset: 2px; }
  `
  return <div css={style} className='widget-setting-layer-compare'>
    {props.useMapWidgetIds?.[0] && <JimuMapViewComponent useMapWidgetId={props.useMapWidgetIds[0]} onActiveViewChange={setMapView} />}
    <SettingSection title={t('mapSection')}><SettingRow label={t('selectMap')} flow='wrap'>
      <MapWidgetSelector useMapWidgetIds={props.useMapWidgetIds} onSelect={(ids: string[]) => {
        setMapView(null); setCatalog([]); props.onSettingChange({ id: props.id, useMapWidgetIds: ids })
      }} />
    </SettingRow></SettingSection>
    <SettingSection title={t('optionsSection')}>
      <SettingRow label={t('direction')} flow='wrap'><Select size='sm' value={direction} aria-label={t('direction')}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => update('direction', event.target.value)}>
        <Option value='horizontal'>{t('leftRight')}</Option><Option value='vertical'>{t('topBottom')}</Option>
      </Select></SettingRow>
      <SettingRow label={t('startPosition')} flow='wrap'><NumericInput size='sm' min={0} max={100} step={1}
        value={clampPosition(config?.initialPosition ?? 50)} aria-label={t('startPosition')}
        onChange={(value: number) => update('initialPosition', clampPosition(value))} /></SettingRow>
      <SettingRow label={t('startLabel')} flow='wrap'><TextInput size='sm' maxLength={60} value={config?.startLabel || ''}
        aria-label={t('startLabel')} onChange={(event: React.ChangeEvent<HTMLInputElement>) => update('startLabel', event.target.value)} /></SettingRow>
      <SettingRow label={t('endLabel')} flow='wrap'><TextInput size='sm' maxLength={60} value={config?.endLabel || ''}
        aria-label={t('endLabel')} onChange={(event: React.ChangeEvent<HTMLInputElement>) => update('endLabel', event.target.value)} /></SettingRow>
      <p className='lc-setting-note'>{t('labelsHint')}</p>
      {toggler('keepOtherLayers', config?.keepOtherLayers === true, t('startContext'))}
      {toggler('allowContextToggle', config?.allowContextToggle !== false, t('allowContextToggle'))}
      {toggler('showHelp', config?.showHelp !== false, t('showHelp'))}
    </SettingSection>
    <SettingSection title={t('availableSection')}>
      <p className='lc-setting-note'>{t('availabilityHint')}</p>
      {!props.useMapWidgetIds?.[0] || !mapView || mapView.view.type !== '2d' ? <p className='lc-setting-note'>{t('previewMap')}</p> : <>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><TextInput size='sm' allowClear value={query}
          placeholder={t('filterLayers')} aria-label={t('filterLayers')} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
          <Button size='sm' type='tertiary' icon disabled={loading} onClick={() => setRefresh(value => value + 1)}
            title={t('refreshLayers')} aria-label={t('refreshLayers')}><CalciteIcon icon='refresh' scale='s' /></Button>
        </div>
        {error && <p role='status' className='lc-setting-note'>{error}</p>}
        {loading ? <p role='status' className='lc-setting-note'>{t('mapLoading')}</p> : <div className='lc-setting-tree'>
          <LayerPicker id={`${props.id}-availability`} scope={scope} tree={catalog} query={query} availability
            selection={{ start: included, end: [] }} startLabel={t('include')} endLabel='' t={t} onToggle={node => {
              const next = new Set(toggleNode(node, included))
              update('excludedLayerKeys', [...excluded.filter(key => !allKeys.includes(key)), ...allKeys.filter(key => !next.has(key))])
            }} />
        </div>}
      </>}
    </SettingSection>
    <SettingSection title={t('defaultSection')}>
      <p className='lc-setting-note'>{t('defaultsHint')}</p>
      {catalog.length > 0 && !loading && <div className='lc-setting-tree'><LayerPicker id={`${props.id}-defaults`} scope={scope} tree={available} query={query}
        selection={defaults} startLabel={startLabel} endLabel={endLabel} t={t} onToggle={(node, side) => {
          const key = side === 'start' ? 'defaultStartKeys' : 'defaultEndKeys'
          const active = new Set(available.flatMap(root => root.leafKeys))
          const otherMaps = (config[key] ?? []).filter(item => !active.has(item) && !allKeys.includes(item))
          update(key, [...otherMaps, ...toggleNode(node, defaults[side])])
        }} /></div>}
    </SettingSection>
    <SettingSection title={t('telemetrySection')}>
      {toggler('telemetry', config?.telemetry !== false, t('telemetryLabel'))}
      <p className='lc-setting-note'>{t('telemetryHint')}</p>
    </SettingSection>
  </div>
}
