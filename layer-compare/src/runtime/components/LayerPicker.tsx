import { React, css } from 'jimu-core'
import { Button, Checkbox } from 'jimu-ui'
import { CalciteIcon } from 'calcite-components'
import { useTokens } from '../theme'
import { filterTree, listedTree, outsideScale, selectionState } from '../layer-model'
import type { LayerNode, Selection } from '../layer-model'

interface Props {
  id: string
  scope: string
  tree: LayerNode[]
  query: string
  selection: Selection
  startLabel: string
  endLabel: string
  disabled?: boolean
  scale?: number
  /** Builder uses the same controls with one Include column. */
  availability?: boolean
  t: (id: string, values?: Record<string, any>) => string
  onToggle: (node: LayerNode, side: 'start' | 'end') => void
}

export default function LayerPicker (props: Props): React.ReactElement {
  const tokens = useTokens()
  const { t } = props
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  React.useEffect(() => {
    setExpanded(new Set(props.tree.filter(node => node.listed && node.children.length).map(node => node.key)))
  }, [props.scope])
  const tree = filterTree(listedTree(props.tree), props.query)
  const columns = props.availability ? 'minmax(0,1fr) 70px' : 'minmax(0,1fr) 68px 68px'
  const style = css`
    color: ${tokens.text};
    ul { list-style: none; padding: 0; margin: 0; }
    .lc-head, .lc-row { display: grid; grid-template-columns: ${columns}; align-items: center; }
    .lc-head { position: sticky; top: 0; z-index: 1; padding: 8px 6px; font-size: 12px; font-weight: 600; background: ${tokens.background}; border-bottom: 1px solid ${tokens.divider}; }
    .lc-head > span:not(:first-of-type) { text-align: center; overflow-wrap: anywhere; }
    .lc-row { min-height: 44px; border-bottom: 1px solid ${tokens.divider}; }
    .lc-row:hover { background: ${tokens.infoBg}; }
    .lc-title { min-width: 0; display: flex; align-items: center; gap: 4px; padding: 6px 2px; }
    .lc-name { min-width: 0; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4; }
    .lc-reason { display: block; font-size: 11px; color: ${tokens.textSecondary}; }
    .lc-check { display: flex; align-items: center; justify-content: center; min-height: 44px; width: 100%; margin: 0; cursor: pointer; }
    .lc-check:focus-within { outline: 2px solid ${tokens.primary}; outline-offset: -3px; border-radius: ${tokens.radius}; }
    button:focus-visible { outline: 2px solid ${tokens.primary}; outline-offset: 1px; }
    .lc-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  `
  const toggleExpand = (node: LayerNode): void => {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(node.key)) next.delete(node.key); else next.add(node.key)
      return next
    })
  }
  const rows = (nodes: LayerNode[], depth: number, ancestorScale: boolean): React.ReactNode => nodes.slice().reverse().map(node => {
    const open = !!props.query.trim() || expanded.has(node.key)
    const outOfScale = ancestorScale || outsideScale(node, props.scale ?? 0)
    const renderCheck = (side: 'start' | 'end', label: string): React.ReactNode => {
      const state = selectionState(node, props.selection[side])
      const inputId = `${props.id}-${side}-${encodeURIComponent(node.key)}`
      const accessible = t(props.availability ? 'includeLayer' : 'sideLayer', { layer: node.title, side: label })
      return <label className='lc-check' htmlFor={inputId} key={side} title={accessible}>
        <Checkbox id={inputId} checked={state.checked} indeterminate={state.partial}
          aria-label={accessible} disabled={props.disabled || !node.leafKeys.length}
          onChange={() => {
            props.onToggle(node, side)
            if (!state.checked && node.children.length) setExpanded(previous => new Set([...previous, node.key]))
          }} />
        <span className='lc-sr'>{accessible}</span>
      </label>
    }
    return <li key={node.key}>
      <div className='lc-row'>
        <div className='lc-title' style={{ paddingLeft: `${Math.min(depth, 4) * 12 + 4}px` }}>
          {node.children.length ? <Button size='sm' type='tertiary' icon onClick={() => toggleExpand(node)}
            aria-expanded={open} title={t(open ? 'collapseLayer' : 'expandLayer', { layer: node.title })}
            aria-label={t(open ? 'collapseLayer' : 'expandLayer', { layer: node.title })}>
            <CalciteIcon icon={open ? 'chevron-down' : 'chevron-right'} scale='s' />
          </Button> : <span aria-hidden='true' style={{ padding: '0 5px', color: tokens.textSecondary }}>
            <CalciteIcon icon='layers' scale='s' />
          </span>}
          <span className='lc-name'>{node.title}
            {node.reason && <span className='lc-reason'>{t(node.reason)}</span>}
            {!node.reason && outOfScale && <span className='lc-reason'>{t('outsideScale')}</span>}
            {!node.children.length && node.source.type === 'tile' && <span className='lc-reason'>{t('wholeTiledLayer')}</span>}
          </span>
        </div>
        {renderCheck('start', props.startLabel)}
        {!props.availability && renderCheck('end', props.endLabel)}
      </div>
      {node.children.length > 0 && open && <ul aria-label={node.title}>{rows(node.children, depth + 1, outOfScale)}</ul>}
    </li>
  })
  return <section css={style} aria-label={t('layerSelections')}>
    <div className='lc-head'><span>{t('layers')}</span><span>{props.availability ? t('include') : props.startLabel}</span>
      {!props.availability && <span>{props.endLabel}</span>}</div>
    {tree.length ? <ul>{rows(tree, 0, false)}</ul> : <p style={{ padding: '12px', fontSize: '13px' }}>{t(props.query ? 'noMatches' : 'noLayers')}</p>}
  </section>
}
