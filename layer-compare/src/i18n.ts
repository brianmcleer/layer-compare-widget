export function translate (intl: any, messages: Record<string, string>, id: string, values?: Record<string, any>): string {
  const message = messages[id] ?? id
  if (intl?.formatMessage) return intl.formatMessage({ id, defaultMessage: message }, values)
  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`))
}
