import { describe, expect, it } from 'vitest'
import { assertEnoughDiskSpace, MIN_FREE_BYTES } from './diskSpace'

describe('disk space precheck', () => {
  it('accepts enough space', () => {
    expect(() => assertEnoughDiskSpace(MIN_FREE_BYTES)).not.toThrow()
  })

  it('reports the available and required size', () => {
    expect(() => assertEnoughDiskSpace(1024, MIN_FREE_BYTES)).toThrow(/磁盘剩余空间不足/)
    expect(() => assertEnoughDiskSpace(1024, MIN_FREE_BYTES)).toThrow(/MB|GB|KB/)
  })
})
