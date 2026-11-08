import { describe, expect, it, vi } from 'vitest'
import {
  INITIAL_UPDATE_STATE,
  checkResult,
  compareVersions,
  progressPercent,
  updateReducer,
} from './appUpdate'
import { performUpdateCheck, performUpdateDownload, performUpdateInstall } from './updateService'

describe('appUpdate', () => {
  it('compares versions including prereleases', () => {
    expect(compareVersions('0.1.1', '0.1.1')).toBe(0)
    expect(compareVersions('v0.1.2', '0.1.1')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-beta.2')).toBe(1)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1)
  })

  it('maps check results to latest/available', () => {
    expect(checkResult(null)).toEqual({ phase: 'latest', info: null })
    expect(checkResult({ version: '0.1.1', currentVersion: '0.1.1' }).phase).toBe('latest')
    const next = checkResult({ version: '0.2.0', currentVersion: '0.1.1', notes: 'x' })
    expect(next.phase).toBe('available')
    expect(next.info?.version).toBe('0.2.0')
  })

  it('walks the update state machine', () => {
    let state = updateReducer(INITIAL_UPDATE_STATE, { type: 'check' })
    expect(state.phase).toBe('checking')

    state = updateReducer(state, { type: 'checked', info: { version: '0.2.0', currentVersion: '0.1.1' } })
    expect(state.phase).toBe('available')

    state = updateReducer(state, { type: 'download' })
    expect(state.phase).toBe('downloading')
    state = updateReducer(state, { type: 'progress', progress: { downloaded: 50, total: 100 } })
    expect(progressPercent(state.progress)).toBe(50)

    state = updateReducer(state, { type: 'ready' })
    expect(state.phase).toBe('ready')

    state = updateReducer(state, { type: 'error', message: 'network' })
    expect(state.phase).toBe('error')
    expect(state.error).toBe('network')

    state = updateReducer(state, { type: 'reset' })
    expect(state).toEqual(INITIAL_UPDATE_STATE)
  })

  it('handles unknown progress totals', () => {
    expect(progressPercent(null)).toBeNull()
    expect(progressPercent({ downloaded: 10, total: null })).toBeNull()
  })

  it('uses the mocked updater for no-update and update branches', async () => {
    const none = vi.fn(async () => null)
    expect(await performUpdateCheck(none)).toEqual({ phase: 'latest', info: null })
    expect(none).toHaveBeenCalledWith('update_check')

    const info = { version: '0.2.0', currentVersion: '0.1.1' }
    const available = vi.fn(async () => info)
    expect(await performUpdateCheck(available)).toEqual({ phase: 'available', info })

    const download = vi.fn(async () => undefined)
    await performUpdateDownload(download, '0.2.0', 'channel')
    expect(download).toHaveBeenCalledWith('update_download', { version: '0.2.0', onProgress: 'channel' })

    const install = vi.fn(async () => undefined)
    await performUpdateInstall(install)
    expect(install).toHaveBeenCalledWith('update_install')
  })
})
