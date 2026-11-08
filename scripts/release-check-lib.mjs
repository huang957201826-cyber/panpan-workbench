export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function parseJsonWithBom(text, label = 'JSON') {
  try {
    return JSON.parse(stripBom(text))
  } catch (err) {
    throw new Error(`${label} 解析失败：${err.message}`)
  }
}

/** B02-3 会改产品名/标识，这里只校验非空和格式，不写死当前值。 */
export function validateProductIdentity(config) {
  const errors = []
  const name = typeof config?.productName === 'string' ? config.productName.trim() : ''
  const identifier = typeof config?.identifier === 'string' ? config.identifier.trim() : ''
  if (!name) errors.push('productName 不能为空')
  if (!identifier) errors.push('identifier 不能为空')
  else if (!/^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z0-9-]+$/.test(identifier)) {
    errors.push(`identifier 格式不正确：${identifier}`)
  }
  return errors
}
