// Editor only. Excluded from the install ZIP so these aliases cannot shadow other widgets.
declare module 'calcite-components' {
  export const CalciteIcon: any
  export const CalciteSlider: any
}
declare module 'arcgis-map-components'
declare module 'esri/core/Collection' {
  export default class Collection<T = any> {
    constructor (items?: T[])
    [key: string]: any
    toArray (): T[]
  }
}
declare module 'esri/core/reactiveUtils' {
  export function watch (value: () => any, callback: (...args: any[]) => void, options?: any): { remove (): void }
}
