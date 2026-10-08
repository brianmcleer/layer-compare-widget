import type { HelpSection } from './components/HelpPopup'
export interface HelpFeatures { contextToggle: boolean }
export function buildHelpSections (t: (id: string) => string, features: HelpFeatures): HelpSection[] {
  return [
    { key: 'start', icon: 'play', title: t('helpStartTitle'), ordered: true, body: ['helpStart1', 'helpStart2', 'helpStart3'].map(t) },
    { key: 'layers', icon: 'layers', title: t('helpLayersTitle'), body: [
      ...['helpLayers1', 'helpLayers2', 'helpLayers3', 'helpLayers4', 'helpLayers5'].map(t),
      ...(features.contextToggle ? [t('helpLayersContext')] : [])
    ] },
    { key: 'use', icon: 'compare', title: t('helpUseTitle'), body: ['helpUse1', 'helpUse2', 'helpUse3', 'helpUse4'].map(t) },
    { key: 'stop', icon: 'reset', title: t('helpStopTitle'), body: ['helpStop1', 'helpStop2', 'helpStop3'].map(t) },
    { key: 'trouble', icon: 'exclamation-mark-triangle', title: t('helpTroubleTitle'), body: ['helpTrouble1', 'helpTrouble2', 'helpTrouble3', 'helpTroubleContact'].map(t) },
    { key: 'tips', icon: 'lightbulb', title: t('helpTipsTitle'), body: ['helpTips1', 'helpTips2', 'helpTips3'].map(t) }
  ]
}
