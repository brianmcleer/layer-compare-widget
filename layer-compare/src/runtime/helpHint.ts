export function helpHintKey (widgetId: string): string { return `layerCompare.helpHintDismissed.${widgetId}` }
export function isHelpHintDismissed (widgetId: string): boolean {
  try { return window.localStorage.getItem(helpHintKey(widgetId)) === '1' } catch { return false }
}
export function dismissHelpHint (widgetId: string): void {
  try { window.localStorage.setItem(helpHintKey(widgetId), '1') } catch {}
}
