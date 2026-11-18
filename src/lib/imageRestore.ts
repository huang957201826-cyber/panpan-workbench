export function createImageRestoreMap(ids: string[], operationId: string) {
  return new Map(ids.map((id, index) => [
    id,
    `restore-image-${operationId}-${index + 1}`,
  ]))
}

export function remapImageIdsDeep<T>(value: T, remap: Map<string, string>): T {
  if (typeof value === 'string') return (remap.get(value) ?? value) as T
  if (Array.isArray(value)) {
    return value.map((item) => remapImageIdsDeep(item, remap)) as T
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = remapImageIdsDeep(item, remap)
    }
    return next as T
  }
  return value
}
