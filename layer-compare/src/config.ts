import type { ImmutableObject } from 'jimu-core'

export type CompareDirection = 'horizontal' | 'vertical'

export interface Config {
  direction: CompareDirection
  initialPosition: number
  keepOtherLayers: boolean
  allowContextToggle: boolean
  showHelp: boolean
  startLabel: string
  endLabel: string
  defaultStartKeys: string[]
  defaultEndKeys: string[]
  excludedLayerKeys: string[]
  telemetry: boolean
}

export type IMConfig = ImmutableObject<Config>

export function clampPosition (value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50
}
